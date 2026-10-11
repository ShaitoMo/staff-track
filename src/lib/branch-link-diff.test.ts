import { diffBranchLinks } from '@/lib/branch-link-diff';

describe('diffBranchLinks', () => {
    it('adds every desired link when there is nothing current', () => {
        const diff = diffBranchLinks([], [{ branchId: 1 }, { branchId: 2, machineEmployeeId: 'A1' }]);

        expect(diff.toAdd).toEqual([{ branchId: 1 }, { branchId: 2, machineEmployeeId: 'A1' }]);
        expect(diff.toRemove).toEqual([]);
        expect(diff.toUpdate).toEqual([]);
    });

    it('removes every current link when nothing is desired', () => {
        const diff = diffBranchLinks([{ branchId: 1 }, { branchId: 2 }], []);

        expect(diff.toAdd).toEqual([]);
        expect(diff.toRemove).toEqual([1, 2]);
        expect(diff.toUpdate).toEqual([]);
    });

    it('leaves an unchanged link alone', () => {
        const diff = diffBranchLinks(
            [{ branchId: 1, machineEmployeeId: 'A1' }],
            [{ branchId: 1, machineEmployeeId: 'A1' }],
        );

        expect(diff.toAdd).toEqual([]);
        expect(diff.toRemove).toEqual([]);
        expect(diff.toUpdate).toEqual([]);
    });

    it('treats undefined and empty-string machineEmployeeId as the same (no-op)', () => {
        const diff = diffBranchLinks(
            [{ branchId: 1, machineEmployeeId: undefined }],
            [{ branchId: 1, machineEmployeeId: '' }],
        );

        expect(diff.toUpdate).toEqual([]);
    });

    it('flags a branch that stays linked but whose machineEmployeeId changed as toUpdate, not toAdd/toRemove', () => {
        const diff = diffBranchLinks(
            [{ branchId: 1, machineEmployeeId: 'OLD' }],
            [{ branchId: 1, machineEmployeeId: 'NEW' }],
        );

        expect(diff.toAdd).toEqual([]);
        expect(diff.toRemove).toEqual([]);
        expect(diff.toUpdate).toEqual([{ branchId: 1, machineEmployeeId: 'NEW' }]);
    });

    it('handles a mixed diff: one added, one removed, one updated, one unchanged', () => {
        const current = [
            { branchId: 1, machineEmployeeId: 'A1' }, // unchanged
            { branchId: 2, machineEmployeeId: 'B1' }, // updated
            { branchId: 3 }, // removed
        ];
        const desired = [
            { branchId: 1, machineEmployeeId: 'A1' },
            { branchId: 2, machineEmployeeId: 'B2' },
            { branchId: 4, machineEmployeeId: 'D1' }, // added
        ];

        const diff = diffBranchLinks(current, desired);

        expect(diff.toAdd).toEqual([{ branchId: 4, machineEmployeeId: 'D1' }]);
        expect(diff.toRemove).toEqual([3]);
        expect(diff.toUpdate).toEqual([{ branchId: 2, machineEmployeeId: 'B2' }]);
    });
});
