// 한국 표준시(KST) 기준 날짜 문자열을 만드는 헬퍼 (toISOString은 UTC라 오전 9시 이전에 하루 전 날짜가 나옴)
export const todayKst = (): string =>
    new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
