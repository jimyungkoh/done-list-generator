# done-list-generator

[![npm version](https://img.shields.io/npm/v/done-list-generator?style=flat-square)](https://www.npmjs.com/package/done-list-generator)
[![npm downloads](https://img.shields.io/npm/dm/done-list-generator?style=flat-square)](https://www.npmjs.com/package/done-list-generator)
![node >=18](https://img.shields.io/badge/node-%3E%3D18.0.0-339933?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

로컬 Git 커밋을 기반으로 일일 완료 목록(Done List)을 Markdown 형식으로 생성하는 도구입니다. OpenRouter를 통해 LLM을 활용하며, Windows/macOS/Linux에서 동작하며 Node.js 18 이상을 지원합니다.

## 주요 기능

- 커밋과 변경 사항(diff)을 요약해 간결한 일일 Markdown 보고서를 만듭니다.
- 증분 업데이트: 같은 날 추가 작업 시 기존 파일에 내용을 이어 붙입니다.
- 외부 런타임 의존성 없음: 내장 `fetch`와 Git을 위한 기본 `child_process`만 사용합니다.
- 플랫폼 호환성: Windows/macOS/Linux에서 안전하게 동작하며, 셸 인용 문제를 피합니다(인수 배열 사용).

## 요구 사항

- Node.js 18 이상(ESM 모듈 지원)
- PATH에 Git 설치
- OpenRouter API 접근을 위한 네트워크 연결

## 설치 방법

설치 없이 바로 실행하는 것을 권장합니다:

```bash
npx donelist --dry-run
```

전역 설치하려면:

```bash
npm i -g done-list-generator
donelist --dry-run
```

## 빠른 시작

1. Git 저장소 루트 디렉토리(또는 하위 디렉토리)로 이동하세요.
2. OpenRouter API 키를 설정한 후 실행하세요:

```bash
export OPENROUTER_API_KEY=YOUR_KEY   # Windows PowerShell: $env:OPENROUTER_API_KEY="YOUR_KEY"
npx donelist --lang ko               # en/ja/zh도 가능(기본: ko)
```

현재 작업 디렉토리에 `./done-list/YYYY-MM-DD.md` 파일이 생성됩니다.

## 커밋 범위 선택 기준

- `./done-list/YYYY-MM-DD.md` 파일이 있고 `<!-- lastProcessedCommit: <hash> -->` 주석이 포함되어 있으면, `<hash>..HEAD` 범위의 커밋만 처리해 "추가 업데이트 (HH:mm)" 섹션을 파일 끝에 추가하고 헤더 해시를 업데이트합니다.
- 그렇지 않으면, 오늘 자정(YYYY-MM-DD 00:00)부터 현재까지의 커밋을 처리합니다.
- `--since <iso>` 또는 `--until <iso>` 옵션으로 범위를 직접 지정할 수 있습니다.

## CLI 옵션

```bash
donelist [--dry-run] [--verbose] [--lang <code>] [--model <name>] \
         [--openrouter-key <key>] [--since <iso>] [--until <iso>]
```

- `--lang <code>`: 출력 언어(기본: `ko`).
- `--model <name>`: OpenRouter 모델 지정(선택 사항).
- `--openrouter-key <key>`: 지정하지 않으면 환경 변수 `OPENROUTER_API_KEY`를 사용합니다.
- `--dry-run`: 파일을 저장하지 않고 콘솔에 출력합니다.
- `--since <iso>` / `--until <iso>`: 시간 범위를 수동으로 설정합니다.
- `--verbose`: 상세 로그 출력.

## 출력 형식

현재 작업 디렉토리의 `./done-list/YYYY-MM-DD.md`에 저장됩니다. 파일은 마지막 처리된 커밋 해시를 저장하는 헤더 주석으로 시작합니다:

```markdown
<!-- lastProcessedCommit: <hash> -->

# 완료 목록 - YYYY-MM-DD

## 요약

...

## 세부 사항

- ...
```

같은 날 후속 실행 시:

```markdown
## 추가 업데이트 (HH:mm)

...
```

## 설정 및 환경

CLI 옵션과 환경 변수를 통해 간단히 설정할 수 있습니다.

- `OPENROUTER_API_KEY` 환경 변수 또는 `--openrouter-key` 옵션으로 API 키를 제공하세요.
- 별도의 설정 파일은 필요 없습니다.

## 플랫폼 호환성 주의사항

- `child_process.spawn('git', args, { shell: false })`와 인수 배열을 사용해 Windows/macOS/Linux에서 안정적으로 동작합니다.
- Git이 PATH에 설치되어 있어야 합니다.

## 개인정보 보호 및 보안

이 도구는 요약을 위해 LLM 제공자(OpenRouter)에 커밋 메타데이터와 변경 사항(diff, 크면 잘림)을 전송합니다. 민감한 정보를 포함한 저장소에서는 사용을 피하고, 사용 전 LLM 제공자의 정책을 참고하세요.

## 문제 해결

- "Not a git repository": Git 저장소 내에서 실행하거나 `git init`으로 초기화하세요.
- "No commits to process today": 지정된 시간 범위에 커밋이 없습니다.
- "OpenRouter key missing": `OPENROUTER_API_KEY`를 설정하거나 `--openrouter-key` 옵션을 사용하세요.

## 기여 안내

기여를 환영합니다! 변경 사항은 간단하고 읽기 쉽게 유지해주세요. 단순성과 플랫폼 호환성을 최우선으로 합니다.

### 개발 환경 설정

```bash
git clone <this-repo>
cd done-list-generator
npm i
npm run build
```

임의의 Git 저장소에서 로컬 테스트:

```bash
cd /path/to/your/git/repo
OPENROUTER_API_KEY=YOUR_KEY npx donelist --dry-run
```

### 기여 지침

- PR은 작고 집중적으로 유지하세요. 새로운 런타임 의존성을 추가하지 마세요.
- 플랫폼 호환: 항상 `child_process.spawn('git', args, { shell: false })`와 인수 배열을 사용하세요.
- ESM만 지원, Node 18 이상. `node:` 접두어를 사용해 내장 모듈을 불러오세요.
- 명확한 이름과 작은 모듈을 선호합니다. 공개 인터페이스에는 타입을 추가하세요.
- 과도한 설계는 피하세요: 가독성과 유지보수성을 우선으로 하세요.

### 변경 사항 제출

1. 저장소를 포크하고 기능 브랜치를 만듭니다.
2. 변경 사항을 구현하고, 가능하다면 테스트를 추가합니다.
3. `npm run build`를 실행한 후 실제 저장소에서 `npx donelist --dry-run`을 확인하세요.
4. PR을 열 때 동기와 접근 방법을 설명하세요.

## 라이선스

MIT
