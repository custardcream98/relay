<!-- skills/relay-agent.md -->
# relay-agent

특정 에이전트 한 명만 단독으로 호출한다.
예: `/relay-agent fe "CartItem 컴포넌트 리팩토링해줘"`

## 실행

1. `list_agents`로 사용 가능한 에이전트 목록 확인
2. 지정한 에이전트의 페르소나 + 메모리 로드
3. 해당 에이전트 단독 spawn
4. 완료 후 `append_memory`로 학습 내용 저장
