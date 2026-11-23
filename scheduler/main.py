"""HTTP wrapper around the solver. Only Next.js calls it, with a shared secret."""

import hmac
import os

from fastapi import FastAPI, Header, HTTPException

from solver import NoSolutionError, SolveRequest, SolveResponse, solve

# fail at startup, not on the first request; an empty secret would match a request that sends none
SECRET = os.environ["SCHEDULER_SECRET"]
if not SECRET:
    raise RuntimeError("SCHEDULER_SECRET must not be empty")

app = FastAPI(title="StaffTrack scheduler")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# a plain def runs in FastAPI's threadpool, so a 10 s solve doesn't block the event loop
@app.post("/solve", response_model=SolveResponse, response_model_by_alias=True)
def solve_week(request: SolveRequest, x_scheduler_secret: str = Header(default="")) -> SolveResponse:
    # bytes, not str: compare_digest raises on non-ASCII str, which would answer 500 instead of 401
    if not hmac.compare_digest(x_scheduler_secret.encode(), SECRET.encode()):
        raise HTTPException(status_code=401, detail="Invalid scheduler secret")

    try:
        return solve(request)
    except NoSolutionError as error:
        raise HTTPException(status_code=504, detail=f"No schedule found in time ({error})") from error
