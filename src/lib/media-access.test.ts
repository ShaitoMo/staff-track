import { AccessTokenPayload } from '@/types/auth';

// the services would reach for Prisma; rbac is left real so the access rule itself is exercised
jest.mock('@/services/media-service', () => ({ MediaService: { getMediaById: jest.fn() } }));
jest.mock('@/services/task-instance-service', () => ({ TaskInstanceService: { getTaskInstanceById: jest.fn() } }));
jest.mock('@/services/user-service', () => ({ UserService: { getUserById: jest.fn() } }));

import { requireMediaAccess } from '@/lib/media-access';
import { MediaService } from '@/services/media-service';
import { TaskInstanceService } from '@/services/task-instance-service';
import { ForbiddenError } from '@/exceptions/forbidden-error';
import { MediaNotFoundError } from '@/exceptions/media-not-found-error';
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error';

const getMediaById = MediaService.getMediaById as jest.Mock;
const getTaskInstanceById = TaskInstanceService.getTaskInstanceById as jest.Mock;

const media = { media_id: 12, task_instance_id: 3, file_path: '/uploads/a.jpg' };
const instance = { completed_by: null, assignee: { user_id: 5 }, task: { branch_id: 1, assigned_role_id: null } };

const owner: AccessTokenPayload = { userId: 1, role: 'owner', branchIds: [] };
const assignee: AccessTokenPayload = { userId: 5, role: 'staff', branchIds: [1] };
const stranger: AccessTokenPayload = { userId: 6, role: 'staff', branchIds: [1] };

beforeEach(() => {
    jest.resetAllMocks();
    getMediaById.mockResolvedValue(media);
    getTaskInstanceById.mockResolvedValue(instance);
});

describe('requireMediaAccess', () => {
    it('returns the media record to someone who may see its instance', async () => {
        await expect(requireMediaAccess(assignee, 12)).resolves.toEqual(media);
        await expect(requireMediaAccess(owner, 12)).resolves.toEqual(media);
    });

    it('propagates a refusal for someone who may not', async () => {
        await expect(requireMediaAccess(stranger, 12)).rejects.toThrow(ForbiddenError);
    });

    it('fails closed when the parent instance is missing, instead of skipping the check', async () => {
        getTaskInstanceById.mockResolvedValue(null);

        await expect(requireMediaAccess(owner, 12)).rejects.toThrow(TaskInstanceNotFoundError);
    });

    it('does not look up the instance for an unknown media id', async () => {
        getMediaById.mockRejectedValue(new MediaNotFoundError());

        await expect(requireMediaAccess(owner, 99)).rejects.toThrow(MediaNotFoundError);
        expect(getTaskInstanceById).not.toHaveBeenCalled();
    });
});
