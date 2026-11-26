// the logger would reach for pino
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))

import { solveSchedule } from './scheduler-client'
import { SolverRequest } from '@/types/schedule-builder'

const request = {} as SolverRequest

const env = process.env

beforeEach(() => {
    process.env = { ...env, SCHEDULER_URL: 'http://solver.test', SCHEDULER_SECRET: 'secret' }
})

afterEach(() => {
    process.env = env
    jest.restoreAllMocks()
})

describe('solveSchedule', () => {
    it('fails with SOLVER_NOT_CONFIGURED when the solver env vars are missing', async () => {
        delete process.env.SCHEDULER_URL

        await expect(solveSchedule(request)).rejects.toMatchObject({ code: 'SOLVER_NOT_CONFIGURED' })
    })

    it.each([401, 403])('fails with SOLVER_NOT_CONFIGURED when the solver refuses our secret (%i)', async (status) => {
        jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status }))

        await expect(solveSchedule(request)).rejects.toMatchObject({ code: 'SOLVER_NOT_CONFIGURED' })
    })

    it('fails with SOLVER_CONTRACT_MISMATCH when the solver rejects the request', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 422 }))

        await expect(solveSchedule(request)).rejects.toMatchObject({ code: 'SOLVER_CONTRACT_MISMATCH' })
    })

    it.each([
        ['outside the contract', '{"unexpected":true}'],
        ['not JSON', '<html>oops</html>'],
    ])('fails with SOLVER_CONTRACT_MISMATCH when the reply is %s', async (_case, reply) => {
        jest.spyOn(global, 'fetch').mockResolvedValue(new Response(reply, { status: 200 }))

        await expect(solveSchedule(request)).rejects.toMatchObject({ code: 'SOLVER_CONTRACT_MISMATCH' })
    })

    it('fails with SOLVER_UNAVAILABLE when the solver fails on its side', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 502 }))

        await expect(solveSchedule(request)).rejects.toMatchObject({ code: 'SOLVER_UNAVAILABLE' })
    })

    it('fails with SOLVER_UNAVAILABLE when the reply times out partway through', async () => {
        const reply = new Response('{}', { status: 200 })
        jest.spyOn(reply, 'json').mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
        jest.spyOn(global, 'fetch').mockResolvedValue(reply)

        await expect(solveSchedule(request)).rejects.toMatchObject({ code: 'SOLVER_UNAVAILABLE' })
    })

    it('fails with SOLVER_UNAVAILABLE when the solver cannot be reached', async () => {
        jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'))

        await expect(solveSchedule(request)).rejects.toMatchObject({ code: 'SOLVER_UNAVAILABLE' })
    })
})
