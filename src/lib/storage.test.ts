const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
    // each command just records its input, so tests can see what was sent
    const command = (name: string) => jest.fn().mockImplementation((input) => ({ name, input }));
    return {
        S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
        PutObjectCommand: command('PutObject'),
        GetObjectCommand: command('GetObject'),
        HeadObjectCommand: command('HeadObject'),
        DeleteObjectCommand: command('DeleteObject'),
        ListObjectsV2Command: command('ListObjectsV2'),
    };
});
jest.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/url'),
}));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
    createGuideUploadUrls,
    createPhotoUploadUrl,
    getPhotoViewUrl,
    InvalidPhotoError,
    listPhotoKeys,
    verifyGuideUpload,
    verifyUploadedPhoto,
} from '@/lib/storage';
import { MAX_PHOTO_BYTES } from '@/lib/photo-limits';

const mockedGetSignedUrl = getSignedUrl as jest.Mock;

beforeAll(() => {
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'id';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'photos';
});

beforeEach(() => {
    mockSend.mockReset();
});

describe('createPhotoUploadUrl', () => {
    it('generates a key under the instance and signs a JPEG-only PUT for it', async () => {
        const { key, uploadUrl } = await createPhotoUploadUrl(17);

        expect(key).toMatch(/^task-instances\/17\/[0-9a-f-]{36}\.jpg$/);
        expect(uploadUrl).toBe('https://signed.example/url');
        const [, command] = mockedGetSignedUrl.mock.calls.at(-1);
        expect(command).toEqual({
            name: 'PutObject',
            input: { Bucket: 'photos', Key: key, ContentType: 'image/jpeg' },
        });
    });
});

describe('verifyUploadedPhoto', () => {
    const key = 'task-instances/17/abc.jpg';

    it('accepts a JPEG within the limit', async () => {
        mockSend.mockResolvedValue({ ContentType: 'image/jpeg', ContentLength: 300_000 });

        await expect(verifyUploadedPhoto(key, 17)).resolves.toBeUndefined();
    });

    it("refuses another instance's key without touching the bucket", async () => {
        await expect(verifyUploadedPhoto('task-instances/18/abc.jpg', 17)).rejects.toThrow(InvalidPhotoError);
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('refuses a key that was never uploaded', async () => {
        mockSend.mockRejectedValue(Object.assign(new Error('not found'), { $metadata: { httpStatusCode: 404 } }));

        await expect(verifyUploadedPhoto(key, 17)).rejects.toThrow('The photo was not uploaded');
    });

    it('lets any other bucket failure through, so the route reports a 500 rather than blaming the photo', async () => {
        mockSend.mockRejectedValue(Object.assign(new Error('denied'), { $metadata: { httpStatusCode: 403 } }));

        await expect(verifyUploadedPhoto(key, 17)).rejects.not.toThrow(InvalidPhotoError);
    });

    it('deletes and refuses an empty upload', async () => {
        mockSend.mockResolvedValueOnce({ ContentType: 'image/jpeg', ContentLength: 0 }).mockResolvedValueOnce({});

        await expect(verifyUploadedPhoto(key, 17)).rejects.toThrow(InvalidPhotoError);
        expect(mockSend).toHaveBeenLastCalledWith({ name: 'DeleteObject', input: { Bucket: 'photos', Key: key } });
    });

    it('deletes and refuses an oversized upload', async () => {
        mockSend
            .mockResolvedValueOnce({ ContentType: 'image/jpeg', ContentLength: MAX_PHOTO_BYTES + 1 })
            .mockResolvedValueOnce({});

        await expect(verifyUploadedPhoto(key, 17)).rejects.toThrow(InvalidPhotoError);
        expect(mockSend).toHaveBeenLastCalledWith({ name: 'DeleteObject', input: { Bucket: 'photos', Key: key } });
    });

    it('deletes and refuses an upload that is not a JPEG', async () => {
        mockSend.mockResolvedValueOnce({ ContentType: 'text/html', ContentLength: 10 }).mockResolvedValueOnce({});

        await expect(verifyUploadedPhoto(key, 17)).rejects.toThrow(InvalidPhotoError);
        expect(mockSend).toHaveBeenCalledTimes(2);
    });
});

describe('getPhotoViewUrl', () => {
    it('forces the served type to JPEG, whatever the stored object claims', async () => {
        await getPhotoViewUrl('task-instances/17/abc.jpg');

        const [, command] = mockedGetSignedUrl.mock.calls.at(-1);
        expect(command.input).toMatchObject({ ResponseContentType: 'image/jpeg', ResponseContentDisposition: 'inline' });
    });
});

describe('listPhotoKeys', () => {
    const cutoff = new Date('2026-10-12T00:00:00Z');
    const old = new Date('2026-10-11T00:00:00Z');
    const fresh = new Date('2026-10-12T12:00:00Z');

    it('pages through the photo prefix and keeps only keys written before the cutoff', async () => {
        mockSend
            .mockResolvedValueOnce({
                Contents: [{ Key: 'task-instances/1/a.jpg', LastModified: old }, { Key: 'task-instances/1/b.jpg', LastModified: fresh }],
                NextContinuationToken: 'next',
            })
            .mockResolvedValueOnce({ Contents: [{ Key: 'task-instances/2/c.jpg', LastModified: old }] });

        const pages: string[][] = [];
        for await (const keys of listPhotoKeys(cutoff)) pages.push(keys);

        expect(pages).toEqual([['task-instances/1/a.jpg'], ['task-instances/2/c.jpg']]);
        expect(mockSend.mock.calls.map(([command]) => command.input)).toEqual([
            { Bucket: 'photos', Prefix: 'task-instances/', ContinuationToken: undefined },
            { Bucket: 'photos', Prefix: 'task-instances/', ContinuationToken: 'next' },
        ]);
    });

    it('yields one empty page for an empty bucket', async () => {
        mockSend.mockResolvedValueOnce({});

        const pages: string[][] = [];
        for await (const keys of listPhotoKeys(cutoff)) pages.push(keys);

        expect(pages).toEqual([[]]);
    });
});

describe('createGuideUploadUrls', () => {
    it('issues a photo and a thumbnail key under the section, sharing one id', async () => {
        const { photo, thumb } = await createGuideUploadUrls(4);

        expect(photo.key).toMatch(/^guide\/sections\/4\/[0-9a-f-]{36}\.jpg$/);
        expect(thumb.key).toBe(photo.key.replace('.jpg', '-thumb.jpg'));
    });
});

describe('verifyGuideUpload', () => {
    const photo = 'guide/sections/4/0f8fad5b-d9cb-469f-a165-70867728950e.jpg';
    const thumb = 'guide/sections/4/0f8fad5b-d9cb-469f-a165-70867728950e-thumb.jpg';

    it('accepts an issued pair of JPEGs within the limit, checking both objects', async () => {
        mockSend.mockResolvedValue({ ContentType: 'image/jpeg', ContentLength: 40_000 });

        await expect(verifyGuideUpload(photo, thumb, 4)).resolves.toBeUndefined();
        expect(mockSend.mock.calls.map(([command]) => command.input.Key)).toEqual([photo, thumb]);
    });

    it("refuses another section's or a task's key without touching the bucket", async () => {
        await expect(verifyGuideUpload(photo.replace('/4/', '/5/'), thumb.replace('/4/', '/5/'), 4)).rejects.toThrow(InvalidPhotoError);
        await expect(verifyGuideUpload('task-instances/4/a.jpg', 'task-instances/4/a-thumb.jpg', 4)).rejects.toThrow(InvalidPhotoError);
        expect(mockSend).not.toHaveBeenCalled();
    });

    it("refuses a thumbnail passed off as a photo, and a thumbnail that isn't the photo's own", async () => {
        await expect(verifyGuideUpload(thumb, thumb.replace('.jpg', '-thumb.jpg'), 4)).rejects.toThrow(InvalidPhotoError);
        await expect(verifyGuideUpload(photo, 'guide/sections/4/other-thumb.jpg', 4)).rejects.toThrow(InvalidPhotoError);
        expect(mockSend).not.toHaveBeenCalled();
    });
});
