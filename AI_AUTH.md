# AI 연결 방식

앱은 두 가지 AI 연결 방식을 제공합니다.

## ChatGPT 구독

- `ChatGPT로 계속하기`를 선택하면 시스템 브라우저에서 OpenAI 로그인을 진행합니다.
- 사용자가 명시적으로 허용한 경우, 이용 가능한 ChatGPT 플랜 사용량으로 원고 생성과 검증을 실행합니다.
- 앱은 ChatGPT 대화 기록이나 API 키에 접근하지 않습니다.
- OAuth 토큰은 Electron 메인 프로세스에서만 취급하며 Windows 보안 저장소로 암호화합니다.
- 연결된 계정에서 사용할 수 있는 모델을 조회해 모델 선택 목록에 표시합니다.

## OpenAI API 키

- 사용자가 직접 입력한 API 키를 Windows 보안 저장소로 암호화합니다.
- API 사용량과 결제는 ChatGPT 구독과 별도로 관리됩니다.
- ChatGPT 구독 연결이 불가능하거나 사용 한도에 도달했을 때 API 키 방식으로 전환할 수 있습니다.

앱은 사용자의 선택 없이 한 결제 방식에서 다른 방식으로 자동 전환하지 않습니다.

## 오픈소스 SDK

ChatGPT 구독 연결은 OpenAI의 `Sign in with ChatGPT DevKit` 중 `@siwc/local` 패키지를 사용합니다. 패키지 라이선스와 제3자 고지는 `vendor/siwc-local-0.1.0.tgz` 안에 포함되어 있습니다.
