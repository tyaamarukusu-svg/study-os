/* 自分専用の確認版。配布版では正式な認証へ差し替える。 */
window.StudyOSGate = {
  protect(_kind, onUnlock) {
    onUnlock();
  },
};
