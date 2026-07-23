// ══════════════════════════════════════════════════════════════
// gdc-balance-banner.js — GDC 저잔액 배너 (SP-GDC-CHARGE-v1_0 §4 보조채널)
// 2026-07-23 신설.
//
// 서버(worker.js)의 GET /biz/balance-status를 조회해, 잔액이 문턱값
// 이하면 배너 엘리먼트를 보여준다. 웹푸시(_sendPushToGuid)는 "앱을
// 안 열어도 오는 알림"이고, 이 배너는 "앱을 열었을 때 확인하는 상태"—
// 두 채널이 서로 대체가 아니라 보완이라는 게 서버쪽 설계 문서(§4)의
// 전제다.
//
// 사용법 (webapp.html/desktop.html 등에서):
//   import { mountLowBalanceBanner } from './js/gdc-balance-banner.js';
//   mountLowBalanceBanner({ userGuid: wallet.guid, containerEl: document.body });
// ══════════════════════════════════════════════════════════════

import { WORKER_URL } from '../config.js';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5분마다 재확인(과도한 폴링 방지)

export async function fetchBalanceStatus(userGuid) {
  const res  = await fetch(`${WORKER_URL}/biz/balance-status?guid=${encodeURIComponent(userGuid)}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) return null;
  return data; // { balance_gdc, balance_krw, low_balance_threshold_krw, is_low_balance }
}

// 배너를 컨테이너에 마운트하고, 5분 간격 폴링 타이머를 반환한다
// (호출부가 clearInterval로 정리할 수 있게).
export function mountLowBalanceBanner({ userGuid, containerEl, chargeUrl = 'https://gdc.hondi.net/charge.html' }) {
  if (!userGuid || !containerEl) return null;

  const banner = document.createElement('div');
  banner.className = 'gdc-low-balance-banner';
  banner.style.cssText = 'display:none;padding:10px 14px;background:#fff3cd;color:#664d03;'
    + 'border:1px solid #ffe69c;border-radius:8px;font-size:14px;margin:8px 0;';
  banner.innerHTML = `
    <span class="gdc-low-balance-text"></span>
    <a class="gdc-low-balance-link" href="${chargeUrl}" style="margin-left:8px;font-weight:600;">지금 충전하기 →</a>
  `;
  containerEl.appendChild(banner);

  async function refresh() {
    const status = await fetchBalanceStatus(userGuid);
    if (!status) return; // 조회 실패 시 배너 상태 유지(과도한 깜빡임 방지)
    if (status.is_low_balance) {
      banner.querySelector('.gdc-low-balance-text').textContent =
        `GDC 잔액이 약 ${status.balance_krw.toLocaleString('ko-KR')}원 상당으로 얼마 남지 않았어요.`;
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }

  refresh();
  const timer = setInterval(refresh, CHECK_INTERVAL_MS);
  return timer;
}
