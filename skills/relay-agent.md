<!-- skills/relay-agent.md -->
# relay-agent

특정 에이전트 한 명만 단독으로 호출한다.
예: `/relay-agent fe "CartItem 컴포넌트 리팩토링해줘"`

## 실행

1. `list_agents`로 사용 가능한 에이전트 목록 확인
2. 지정한 에이전트의 페르소나 + 메모리 로드
3. 해당 에이전트 단독 spawn
4. 완료 후 `append_memory`로 학습 내용 저장

## 알 수 없는 에이전트 처리

지정한 에이전트 ID가 `list_agents` 결과에 없으면:
- 사용 가능한 에이전트 목록을 사용자에게 보여준다
- 다시 에이전트를 선택하도록 요청한다

## 메모리 로드 패턴

2단계에서 메모리를 로드할 때:
1. `read_memory(agent_id: "{agentId}")` — 해당 에이전트의 개인 기억
2. `read_memory()` (agent_id 생략) — project.md + lessons.md 프로젝트 기억
두 결과를 합성하여 system prompt에 prepend한다.
