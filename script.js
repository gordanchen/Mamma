const API_URL = "https://script.google.com/macros/s/AKfycbyrbZ-9il93q_qSPIT2VvssWwrlypctXzmTjdQLe801YvKguySySbeyfGtPHDv9vZfBdQ/exec";
const OPERATOR_CACHE_HOURS = 1;

let currentOperator = "";
let currentStudentId = "";
let progressTimer = null;
let currentIp = "";
let selectedCard = "";
let selectedGift = "";
let scannerInstance = null;
let currentResult = null;

document.addEventListener("DOMContentLoaded", async () => {
  const loginPage = document.getElementById("loginPage");
  const mainPage = document.getElementById("mainPage");
  const operatorNameInput = document.getElementById("operatorName");
  const showOperator = document.getElementById("showOperator");
  const studentIdInput = document.getElementById("studentId");
  const studentNameInput = document.getElementById("studentName");
  const resultArea = document.getElementById("resultArea");
  const resultBadge = document.getElementById("resultBadge");
  const resultText = document.getElementById("resultText");
  const detailMain = document.getElementById("detailMain");
  const detailSub = document.getElementById("detailSub");
  const registerBox = document.getElementById("registerBox");
  const progressWrap = document.getElementById("progressWrap");
  const progressBar = document.getElementById("progressBar");
  const enterBtn = document.getElementById("enterBtn");
  const backBtn = document.getElementById("backBtn");
  const searchBtn = document.getElementById("searchBtn");
  const registerBtn = document.getElementById("registerBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const scanBtn = document.getElementById("scanBtn");
  const scannerBox = document.getElementById("scanner");
  const btnPostcard = document.getElementById("btnPostcard");
  const btnJob = document.getElementById("btnJob");
  const btnFlower = document.getElementById("btnFlower");
  const btnSoap = document.getElementById("btnSoap");
  const cardBlock = document.getElementById("cardBlock");
  const giftBlock = document.getElementById("giftBlock");

  function normalizeInputId(value) {
    return String(value || "").trim().toUpperCase();
  }

  async function getPublicIp() {
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const data = await res.json();
      return data.ip || "未知IP";
    } catch (error) {
      return "未知IP";
    }
  }

  function getOperatorCache() {
    try {
      return JSON.parse(localStorage.getItem("pickup_operator_cache") || "{}");
    } catch (error) {
      return {};
    }
  }

  function setOperatorCache(operatorName, ip) {
    const data = {
      operatorName,
      ip,
      time: Date.now()
    };
    localStorage.setItem("pickup_operator_cache", JSON.stringify(data));
  }

  function clearOperatorCache() {
    localStorage.removeItem("pickup_operator_cache");
  }

  function isOperatorCacheValid(cache, ip) {
    if (!cache || !cache.operatorName || !cache.ip || !cache.time) return false;
    if (cache.ip !== ip) return false;

    const limit = OPERATOR_CACHE_HOURS * 60 * 60 * 1000;
    return Date.now() - cache.time <= limit;
  }

  function startProgress() {
    stopProgressImmediately();
    progressWrap.classList.remove("hidden");
    progressBar.style.width = "8%";

    let progress = 8;
    progressTimer = setInterval(() => {
      if (progress < 92) {
        progress += 6;
        progressBar.style.width = progress + "%";
      }
    }, 120);
  }

  function stopProgress() {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }

    progressBar.style.width = "100%";

    setTimeout(() => {
      progressWrap.classList.add("hidden");
      progressBar.style.width = "0%";
    }, 250);
  }

  function stopProgressImmediately() {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
    progressWrap.classList.add("hidden");
    progressBar.style.width = "0%";
  }

  function clearSelections() {
    selectedCard = "";
    selectedGift = "";
    [btnPostcard, btnJob, btnFlower, btnSoap].forEach(btn => {
      if (btn) btn.classList.remove("active");
    });
  }

  function resetResult() {
    resultArea.classList.add("hidden");
    registerBox.classList.add("hidden");
    cardBlock.classList.add("hidden");
    giftBlock.classList.add("hidden");
    resultBadge.textContent = "";
    resultText.textContent = "";
    detailMain.textContent = "";
    detailSub.textContent = "";
    studentNameInput.value = "";
    currentResult = null;
    clearSelections();
  }

  function backToSearchInput() {
    resetResult();
    studentIdInput.value = "";
    studentNameInput.value = "";
    currentStudentId = "";
    studentIdInput.focus();
  }

  function jsonpRequest(params) {
    return new Promise((resolve, reject) => {
      if (!API_URL || API_URL.includes("把你的 Apps Script 網址貼這裡")) {
        reject(new Error("請先在 script.js 設定 API_URL"));
        return;
      }

      const callbackName = "jsonp_callback_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      const script = document.createElement("script");

      params.callback = callbackName;

      const queryString = new URLSearchParams(params).toString();
      script.src = API_URL + "?" + queryString;

      let finished = false;

      window[callbackName] = function(data) {
        finished = true;
        resolve(data);
        cleanup();
      };

      script.onerror = function() {
        if (!finished) {
          reject(new Error("無法連線到 Apps Script，請檢查部署網址與權限"));
          cleanup();
        }
      };

      const timeout = setTimeout(() => {
        if (!finished) {
          reject(new Error("連線逾時，請檢查 Apps Script 是否已正確部署"));
          cleanup();
        }
      }, 15000);

      function cleanup() {
        clearTimeout(timeout);
        if (script.parentNode) script.parentNode.removeChild(script);
        try {
          delete window[callbackName];
        } catch (e) {
          window[callbackName] = undefined;
        }
      }

      document.body.appendChild(script);
    });
  }

  function goToMainPage(operatorName) {
    currentOperator = operatorName;
    showOperator.textContent = operatorName;
    loginPage.classList.add("hidden");
    mainPage.classList.remove("hidden");
    operatorNameInput.value = operatorName;
    studentIdInput.focus();
  }

  function goToLoginPage() {
    currentOperator = "";
    currentStudentId = "";
    operatorNameInput.value = "";
    studentIdInput.value = "";
    studentNameInput.value = "";
    resetResult();
    stopProgressImmediately();
    mainPage.classList.add("hidden");
    loginPage.classList.remove("hidden");
    operatorNameInput.focus();
  }

  function saveOperator() {
    const name = operatorNameInput.value.trim();

    if (!name) {
      alert("請輸入操作人員名字");
      operatorNameInput.focus();
      return;
    }

    setOperatorCache(name, currentIp);
    goToMainPage(name);
  }

  function changeOperator() {
    clearOperatorCache();
    goToLoginPage();
  }

  function renderResult(res) {
    currentResult = res;
    resultArea.classList.remove("hidden");
    registerBox.classList.remove("hidden");
    clearSelections();

    const cardText = res.cardType ? res.cardType : "未領取";
    const cardTimeText = res.cardTime ? res.cardTime : "-";
    const cardOperatorText = res.cardOperator ? res.cardOperator : "-";
    const giftText = res.giftType ? res.giftType : "未領取";
    const giftTimeText = res.giftTime ? res.giftTime : "-";
    const giftOperatorText = res.giftOperator ? res.giftOperator : "-";

    detailMain.textContent =
      "學號：" + (res.studentId || "") + "\n" +
      "姓名：" + (res.name || "") + "\n" +
      "已領取卡片：" + cardText + "\n" +
      "已領取禮品：" + giftText;

    detailSub.textContent =
      "卡片登記時間：" + cardTimeText + "\n" +
      "卡片登記人員：" + cardOperatorText + "\n" +
      "禮品登記時間：" + giftTimeText + "\n" +
      "禮品登記人員：" + giftOperatorText;

    if (res.hasCard && res.hasGift) {
      resultBadge.textContent = "查詢結果";
      resultBadge.className = "status-chip badge-done";
      resultText.textContent = "已全部領取";
      registerBox.classList.add("hidden");
      return;
    }

    resultBadge.textContent = "查詢結果";
    resultBadge.className = "status-chip badge-undone";

    if (!res.hasCard) {
      resultText.textContent = "可先發卡片";
      cardBlock.classList.remove("hidden");
      giftBlock.classList.add("hidden");
    } else {
      resultText.textContent = "可領取禮品";
      cardBlock.classList.add("hidden");
      giftBlock.classList.remove("hidden");
    }

    studentNameInput.value = res.name || "";
  }

  async function searchStudent() {
    const rawId = studentIdInput.value.trim();

    if (!currentOperator) {
      alert("請先輸入操作人員");
      return;
    }

    if (!rawId) {
      alert("請輸入學號");
      studentIdInput.focus();
      return;
    }

    const hasLowercaseEnglish = /[a-z]/.test(rawId);
    const normalizedId = normalizeInputId(rawId);

    studentIdInput.value = normalizedId;
    currentStudentId = normalizedId;

    if (hasLowercaseEnglish) {
      alert("偵測到學號含小寫英文，已自動轉為大寫");
    }

    resetResult();
    startProgress();

    try {
      const res = await jsonpRequest({
        action: "checkStudent",
        studentId: normalizedId,
        operatorName: currentOperator,
        ip: currentIp
      });

      stopProgress();

      if (!res.ok) {
        alert(res.message || "查詢失敗");
        return;
      }

      renderResult(res);
    } catch (error) {
      stopProgress();
      alert("系統錯誤：" + error.message);
    }
  }

  async function confirmRegister() {
    const studentName = studentNameInput.value.trim();

    if (!currentStudentId) {
      alert("請先搜尋學號");
      return;
    }

    if (!studentName) {
      alert("請輸入學生名字");
      studentNameInput.focus();
      return;
    }

    let cardType = "";
    let giftType = "";

    if (currentResult && !currentResult.hasCard) {
      if (!selectedCard) {
        alert("請先選擇卡片");
        return;
      }
      cardType = selectedCard;
    }

    if (currentResult && currentResult.hasCard && !currentResult.hasGift) {
      if (!selectedGift) {
        alert("請先選擇禮品");
        return;
      }
      giftType = selectedGift;
    }

    startProgress();

    try {
      const res = await jsonpRequest({
        action: "registerPickup",
        studentId: currentStudentId,
        studentName: studentName,
        operatorName: currentOperator,
        ip: currentIp,
        cardType: cardType,
        giftType: giftType
      });

      stopProgress();

      if (!res.ok) {
        alert(res.message || "登記失敗");
        return;
      }

      if (cardType) {
        alert(
          res.studentId + "-" + res.studentName + "\n" +
          cardType + "\n" +
          "登記成功"
        );
        backToSearchInput();
        return;
      }

      renderResult({
        ok: true,
        studentId: res.studentId,
        name: res.studentName,
        cardType: res.cardType,
        cardTime: res.cardTime,
        cardOperator: res.cardOperator,
        giftType: res.giftType,
        giftTime: res.giftTime,
        giftOperator: res.giftOperator,
        hasCard: !!res.cardType,
        hasGift: !!res.giftType,
        ip: res.ip
      });
    } catch (error) {
      stopProgress();
      alert("系統錯誤：" + error.message);
    }
  }

  async function cancelRegisterAction() {
    if (!currentStudentId) {
      resetResult();
      return;
    }

    try {
      const res = await jsonpRequest({
        action: "cancelRegister",
        studentId: currentStudentId
      });

      alert(res.message || "已取消");
      backToSearchInput();
    } catch (error) {
      alert("系統錯誤：" + error.message);
    }
  }

  function setActiveButton(group, target, value, type) {
    group.forEach(btn => btn.classList.remove("active"));
    target.classList.add("active");

    if (type === "card") selectedCard = value;
    if (type === "gift") selectedGift = value;
  }

  if (btnPostcard) {
    btnPostcard.addEventListener("click", () => {
      setActiveButton([btnPostcard, btnJob], btnPostcard, "明信片", "card");
    });
  }

  if (btnJob) {
    btnJob.addEventListener("click", () => {
      setActiveButton([btnPostcard, btnJob], btnJob, "徵才闖關卡", "card");
    });
  }

  if (btnFlower) {
    btnFlower.addEventListener("click", () => {
      setActiveButton([btnFlower, btnSoap], btnFlower, "DIY花束", "gift");
    });
  }

  if (btnSoap) {
    btnSoap.addEventListener("click", () => {
      setActiveButton([btnFlower, btnSoap], btnSoap, "香皂花束", "gift");
    });
  }

  if (enterBtn) enterBtn.addEventListener("click", saveOperator);
  if (backBtn) backBtn.addEventListener("click", changeOperator);
  if (searchBtn) searchBtn.addEventListener("click", searchStudent);
  if (registerBtn) registerBtn.addEventListener("click", confirmRegister);
  if (cancelBtn) cancelBtn.addEventListener("click", cancelRegisterAction);

  if (scanBtn) {
    scanBtn.addEventListener("click", async () => {
      try {
        scannerBox.classList.remove("hidden");

        if (!scannerInstance) {
          scannerInstance = new Html5Qrcode("scanner");
        }

        await scannerInstance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          async (decodedText) => {
            studentIdInput.value = decodedText;
            await scannerInstance.stop();
            scannerBox.classList.add("hidden");
            searchStudent();
          }
        );
      } catch (error) {
        alert("掃碼啟動失敗：" + error.message);
      }
    });
  }

  if (studentIdInput) {
    studentIdInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        searchStudent();
      }
    });
  }

  stopProgressImmediately();
  resetResult();

  currentIp = await getPublicIp();

  const cache = getOperatorCache();
  if (isOperatorCacheValid(cache, currentIp)) {
    goToMainPage(cache.operatorName);
  } else {
    clearOperatorCache();
    goToLoginPage();
  }
});