# 기여 가이드 (CONTRIBUTING)

감사합니다! 이 프로젝트에 기여하기 전에 아래 가이드를 읽어 주세요.

## 철학
- 단순성, 가독성, 크로스플랫폼 안전성을 최우선으로 합니다.
- 런타임 의존성 추가는 지양합니다. Node.js 내장과 표준 API를 우선합니다.

## 이슈 & PR 워크플로우
1. 이슈를 열어 제안/버그를 공유하거나, 라벨이 달린 작업(`good first issue`, `help wanted`)을 선택합니다.
2. 포크 후 기능 브랜치를 만듭니다: `feature/<요약>` 또는 `fix/<요약>`.
3. 작업 단위를 작고 명확하게 유지합니다. 커밋은 아래 컨벤션을 따릅니다.
4. 수동 검증 체크리스트를 통과합니다(아래 참조).
5. PR을 열고 동기, 접근 방법, 수동 검증 결과를 적습니다.

## 커밋 컨벤션 (Conventional Commits)
- 형식: `type: 설명`
- 예시:
  - `feat: add --lang default resolution`
  - `fix: guard against detached HEAD without name/email`
  - `docs: add troubleshooting examples`

## 브랜치 전략
- `feature/*`, `fix/*`, `docs/*` 권장.
- 필요 시 rebase로 히스토리를 정리하고, PR은 squash merge 권장.

## 개발 스크립트
- `npm run build`: TypeScript 빌드(`dist/` 생성)
- `npm run dev`: 컴파일된 CLI를 드라이런으로 실행(파일 저장 안 함)
- `npm run start`: 파일 출력 활성화 실행
- `npm run clean`: `dist/` 정리 후 재빌드용

## 코드 스타일
- ESM, Node 18+. 내장 모듈은 `node:` 프리픽스로 임포트
- 두 칸 스페이스 들여쓰기, camelCase 변수/함수, PascalCase 타입
- 작은 모듈, 순수 함수 지향. 공개 표면에는 명시적 타입

## 보안/프라이버시
- API 키를 코드에 하드코딩하지 않습니다. `OPENROUTER_API_KEY` 또는 `--openrouter-key` 사용
- 커밋 메타/디프가 외부 LLM으로 전송됩니다. 민감한 저장소에서는 사용 금지
- 커밋 디프는 대용량 보호(트렁케이션) 로직이 있으며, 필요 시 문서의 경고를 재확인하세요

## 수동 검증 체크리스트
1. `npm run build` 성공
2. 임의의 Git 저장소에서 다음 실행
   ```bash
   OPENROUTER_API_KEY=YOUR_KEY npx donelist --dry-run
   ```
   - 첫 실행: `done-list/YYYY-MM-DD.md` 생성 확인
   - 같은 날 재실행: "추가 업데이트 (HH:mm)" 섹션이 이어붙는지 확인
3. 옵션 플래그 점검: `--lang`, `--model`, `--author`, `--author-email`, `--since/--until`, `--verbose`
4. Windows/macOS/Linux 경로/인수 처리 안전성 확인

## 코드 오브 컨덕트
- Contributor Covenant를 준수한다고 가정합니다. 위반 사례 보고는 이슈로 접수하세요.

## 릴리스
- semver를 따르며, 릴리스 노트에는 주요 변경점과 수동 검증 항목을 포함합니다.
