import { ALL_BRANCHES, branchCookieString, parseBranchId, resolveBranchId } from '@/lib/branch-selection';

describe('parseBranchId', () => {
    it('reads a whole number and nothing else', () => {
        expect(parseBranchId('12')).toBe(12);
        expect(parseBranchId('all')).toBeUndefined();
        expect(parseBranchId('1.5')).toBeUndefined();
        expect(parseBranchId('')).toBeUndefined();
        expect(parseBranchId(null)).toBeUndefined();
    });
});

describe('resolveBranchId', () => {
    const branchIds = [1, 2, 3];

    it('lets a ?branch= link win over the remembered choice', () => {
        expect(resolveBranchId('2', '3', branchIds)).toBe(2);
    });

    it('uses the remembered branch when there is no link', () => {
        expect(resolveBranchId(undefined, '3', branchIds)).toBe(3);
    });

    it('is every branch for "all" or nothing saved', () => {
        expect(resolveBranchId(undefined, ALL_BRANCHES, branchIds)).toBeUndefined();
        expect(resolveBranchId(undefined, undefined, branchIds)).toBeUndefined();
    });

    it('ignores a branch the viewer no longer has, from either source', () => {
        expect(resolveBranchId('9', undefined, branchIds)).toBeUndefined();
        expect(resolveBranchId('9', '2', branchIds)).toBe(2);
        expect(resolveBranchId(undefined, '9', branchIds)).toBeUndefined();
    });

    it('always gives someone with one branch that branch', () => {
        expect(resolveBranchId(undefined, ALL_BRANCHES, [4])).toBe(4);
        expect(resolveBranchId('9', '9', [4])).toBe(4);
    });

    it('is every branch when there are none', () => {
        expect(resolveBranchId('1', '1', [])).toBeUndefined();
    });
});

describe('branchCookieString', () => {
    it('is site-wide and lasts a year', () => {
        expect(branchCookieString('2')).toBe('stafftrack_branch=2; Path=/; Max-Age=31536000; SameSite=Lax');
    });
});
