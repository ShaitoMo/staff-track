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
    };
});
jest.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/url'),
}));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPhotoUploadUrl, getPhotoViewUrl, InvalidPhotoError, verifyUploadedPhoto } from '@/lib/storage';
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
