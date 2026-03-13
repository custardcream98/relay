<!-- skills/relay.md -->
# relay

스타트업 팀이 태스크를 처음부터 끝까지 처리한다.
워크플로는 `agents.yml`의 `workflow` 섹션에 정의된 대로 동적으로 실행된다.

## 실행 전 확인

1. relay MCP 서버 연결 확인 (`list_agents` 호출)
2. `.relay/memory/project.md` 존재 확인
   - 없으면: "init이 필요합니다. `/relay-init`을 먼저 실행하시겠어요?" 제안
3. 새 세션 ID 생성: `YYYY-MM-DD-NNN` 형식

## 워크플로 실행

### Step 1: 워크플로 로드
`get_workflow`를 호출하여 전체 job 구성을 가져온다.

시작 job 감지: 어떤 job의 `end`에도 목적지로 지정되지 않은 job이 시작점.
```
const allTargets = new Set(jobs의 모든 end 값들의 key 목록)
const startJob = jobs 중 allTargets에 없는 job
```

### Step 2: Job 실행 루프

현재 job부터 `_done`에 도달할 때까지 반복:

```
currentJob = startJob

while (currentJob !== "_done"):
  job = workflow.jobs[currentJob]

  # job의 에이전트들을 병렬 spawn
  for each agentId in job.agents:
    spawn agent with:
      - 페르소나: list_agents로 로드
      - 기억: read_memory(agent_id) + read_memory() 합성
      - 추가 system prompt 주입:
          ## 현재 Job: {currentJob}
          {job.description}

          ## 완료 조건 및 다음 단계
          작업이 완료되면 아래 조건을 판단하여 선언하세요:
          send_message(to: null, content: "end:{nextJobId} | {이유}")
          {job.end 조건 목록}

          ## 실패 처리
          복구 불가능한 오류가 발생하면 (필수 아티팩트 없음, 툴 호출 반복 실패 등)
          작업을 중단하고 아래 형식으로 실패를 선언하세요:
          send_message(to: null, content: "end:failed | {실패 원인 상세}")
          실패 선언 후 추가 작업을 시도하지 마세요.

  # 모든 에이전트의 end 선언 수집 대기
  # get_messages를 ~30초마다 호출하여 content가 "end:"로 시작하는 메시지 탐지
  # 지원 형식:
  #   "end:{nextJobId} | {이유}"  — 성공, nextJobId로 진행
  #   "end:failed | {이유}"       — 에이전트 실패, 워크플로 중단
  #
  # 타임아웃: 최대 10분 대기. 10분 내에 모든 에이전트의 end 선언이 도착하지 않으면
  #   응답하지 않은 에이전트 목록을 사용자에게 보고하고, 진행 여부를 사용자가 결정.
  #   (도착한 선언만으로 다음 job을 결정하거나, 워크플로를 중단할 수 있음)

  expectedAgents = job.agents (+ reviewers 포함 시 reviewers 목록도 합산)
  startTime = now()
  declarations = []

  while declarations 수 < expectedAgents 수:
    if now() - startTime > 10분:
      missingAgents = expectedAgents - declarations에서 이미 응답한 에이전트 목록
      사용자에게 경고: "⚠️ 타임아웃: {missingAgents}이(가) 응답하지 않았습니다. 도착한 응답으로 계속하시겠습니까?"
      사용자 결정에 따라 진행 또는 중단
      break

    새 메시지 확인 (get_messages)
    새로 수신된 "end:"로 시작하는 메시지를 declarations에 추가

    # 실패 선언 즉시 처리
    if any declaration matches "end:failed":
      failedAgent = 해당 에이전트 ID
      reason = 선언 메시지의 {이유} 부분
      사용자에게 즉시 보고: "❌ {failedAgent} 실패: {reason}"
      워크플로 중단 (currentJob = "_failed")
      break

    ~30초 대기 후 재시도

  # 다음 job 결정 (정상 완료 시)
  if all declarations point to same nextJob:
    currentJob = nextJob
  else:
    # 의견 갈림 → 보수적 경로 우선 (advancing보다 looping back 선호)
    # job.end 조건 설명과 수집된 이유를 종합하여 가장 보수적인 선택 적용
    currentJob = decide based on job.end conditions and collected reasons, preferring the most conservative path (loop back over advance)
```

### Step 3: 세션 종료 (`_done` 도달 시)
1. 각 에이전트에게 `append_memory`로 이번 세션 학습 내용 저장 요청
2. `append_memory(agent_id: undefined, content: "팀 회고...")`로 `lessons.md` 업데이트
   - `agent_id`를 명시하지 않으면 프로젝트 공유 기억인 `lessons.md`에 추가됨
3. `save_session_summary`로 세션 아카이브 (tasks + messages 포함)
4. 사용자에게 결과 요약 보고

## 에이전트 spawn 패턴

각 에이전트 spawn 시 항상:
1. `list_agents`로 해당 에이전트 페르소나 로드
   - agentId가 list_agents에 없으면 reviewers 맵에서 역방향 탐색:
     `reviewers` 값 목록에서 agentId를 찾아 → key 에이전트의 페르소나 사용
     (예: fe2 → reviewers.fe = [fe2] → fe 페르소나 로드, agent_id는 fe2로 설정)
2. `read_memory(agent_id)`로 개인 기억 로드
3. `read_memory()` (agent_id 없음)로 프로젝트 기억 로드
4. system prompt = 페르소나 + 기억 + 현재 job 정보 합성
5. MCP 툴 목록 = 해당 에이전트의 `tools` 배열

## reviewers 처리

job에 `reviewers` 필드가 있으면, 리뷰어 에이전트 spawn 시 추가 컨텍스트 주입:
- `reviewers.fe: [fe2]` → fe2 spawn 시: "fe가 작성한 아티팩트를 리뷰하세요 (`get_artifact`로 fe-pr 조회)"
- 리뷰어도 동일하게 `end:{nextJobId} | {이유}` 선언으로 완료 처리
- 모든 에이전트(작업자 + 리뷰어)의 end 선언 수집 후 다음 job 결정
