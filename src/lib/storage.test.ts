import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PhotoNotFoundError, readPhoto } from '@/lib/storage';

const UPLOADS = path.join(process.cwd(), 'uploads');
const TEST_FILE = 'storage-test-fixture.png';

describe('readPhoto', () => {
    beforeAll(async () => {
        await mkdir(UPLOADS, { recursive: true });
        await writeFile(path.join(UPLOADS, TEST_FILE), Buffer.from([1, 2, 3]));
    });

    afterAll(async () => {
        await rm(path.join(UPLOADS, TEST_FILE), { force: true });
    });

    it('reads a stored photo and derives the content type from its extension', async () => {
        const photo = await readPhoto(`/uploads/${TEST_FILE}`);

        expect(photo.contentType).toBe('image/png');
        expect([...photo.data]).toEqual([1, 2, 3]);
    });

    it('cannot be steered out of the upload directory', async () => {
        // reduces to the basename 'passwd.png', which is not in uploads/
        await expect(readPhoto('/uploads/../../etc/passwd.png')).rejects.toThrow(PhotoNotFoundError);
    });

    it('reports a missing file as not found', async () => {
        await expect(readPhoto('/uploads/nope.jpg')).rejects.toThrow(PhotoNotFoundError);
    });

    it('treats an extension we never write as not found', async () => {
        await expect(readPhoto('/uploads/notes.txt')).rejects.toThrow(PhotoNotFoundError);
    });
});
