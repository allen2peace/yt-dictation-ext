let loopStart = null;
let loopEnd = null;
let videoElement = null;

function setupLoopListener() {
  videoElement = document.querySelector("video");
  if (videoElement) {
    videoElement.addEventListener("timeupdate", checkAndLoop);
    videoElement.addEventListener("loadedmetadata", clearLoop);
  }
}

function checkAndLoop() {
  if (
    loopStart !== null &&
    loopEnd !== null &&
    videoElement.currentTime >= loopEnd
  ) {
    videoElement.currentTime = loopStart;
  }
}

function clearLoop() {
  loopStart = null;
  loopEnd = null;

  try {
    chrome.runtime.sendMessage({ action: "loopCleared" });
  } catch (err) {
    console.log("Extension context invalidated, unable to send message.");
  }
}

function sendMessageToExtension(message) {
  try {
    chrome.runtime.sendMessage(message);
  } catch (error) {
    console.log("Extension context invalidated, unable to send message.");
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setLoop") {
    loopStart = parseFloat(request.startTime);
    loopEnd = parseFloat(request.endTime);
    if (videoElement) {
      videoElement.currentTime = loopStart;
    }
  } else if (request.action === "clearLoop") {
    clearLoop();
  }
});

// Wait for the video element to be added to the page
const observer = new MutationObserver(() => {
  if (document.querySelector("video")) {
    setupLoopListener();
    observer.disconnect();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Listen for page unload to clear the loop
window.addEventListener("beforeunload", clearLoop);

// Send message when page is loaded (which includes reloads)

window.addEventListener("load", () => {
  try {
    chrome.storage.local.set({ pageReloaded: true });
    chrome.runtime.sendMessage({ action: "pageReloaded" });
  } catch (error) {
    console.log(
      "Extension context invalidated, unable to set storage or send message."
    );
  }
});

function addButtonToYouTubePlayer() {
  console.log('尝试添加按钮');
  const controlBar = document.querySelector('.ytp-right-controls');
  if (!controlBar) {
    console.log('未找到控制栏');
    return;
  }

  console.log('找到控制栏，创建按钮');
  const button = document.createElement('button');
  button.className = 'ytp-button loop-button';
  button.title = '循环播放';
  
  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('icons/inactive16.png');
  img.style.cssText = `
    width: 100%;
    height: 100%;
    pointer-events: none;
  `;
  
  button.appendChild(img);
  button.style.cssText = `
    width: 48px;
    height: 48px;
    opacity: 0.9;
    cursor: pointer;
    border: none;
    background: transparent;
    padding: 8px;
  `;

  button.addEventListener('click', () => {
    console.log('按钮被点击了!');
    // 在这里添加您想要的点击事件处理逻辑
  });

  controlBar.appendChild(button);
  console.log('按钮已添加到控制栏');
}

// 监听页面变化,确保在视频加载后添加按钮
const observerForButton = new MutationObserver(() => {
  console.log('DOM变化检测到');
  if (document.querySelector('.ytp-right-controls')) {
    console.log('找到视频控制栏，准备添加按钮');
    addButtonToYouTubePlayer();
    observerForButton.disconnect();
    console.log('观察器已断开连接');
  }
});

console.log('开始观察DOM变化');
observerForButton.observe(document.body, { childList: true, subtree: true });
