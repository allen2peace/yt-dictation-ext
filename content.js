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

let youtubeApiReady = false;

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
  button.title = '全屏播放';
  
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

  button.addEventListener('click', createOverlayPlayer);

  controlBar.appendChild(button);
  console.log('按钮已添加到控制栏');
}

function createOverlayPlayer() {
  console.log('按钮被点击了!');
  
  const videoElement = document.querySelector('video');
  if (!videoElement) {
    console.log('无法找到视频元素');
    return;
  }

  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgb(0, 0, 0);
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  // 保存视频元素的原始样式和父元素
  const originalStyle = videoElement.style.cssText;
  const originalParent = videoElement.parentElement;
  const originalNextSibling = videoElement.nextSibling;

  // 计算视频的新尺寸
  const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
  const newWidth = Math.floor(window.innerWidth * 0.5);
  const newHeight = Math.floor(newWidth / aspectRatio);

  // 修改视频元素样式
  videoElement.style.cssText = `
    width: ${newWidth}px;
    height: ${newHeight}px;
    object-fit: contain;
    z-index: 10000;
   position: absolute;
    top: 30%;
    left: 50%;
    transform: translate(-50%, -50%);
  `;
  
  // 移除所有控制按钮
  videoElement.controls = false;

  // 将视频元素移动到遮罩层
  overlay.appendChild(videoElement);
  document.body.appendChild(overlay);

  // 添加点击事件以关闭遮罩层
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      // 恢复视频元素到原始位置和样式
      if (originalNextSibling) {
        originalParent.insertBefore(videoElement, originalNextSibling);
      } else {
        originalParent.appendChild(videoElement);
      }
      videoElement.style.cssText = originalStyle;
      videoElement.controls = true;
      
      // 移除遮罩层
      document.body.removeChild(overlay);
    }
  });

  console.log('遮罩层和视频已添加');
}

// 辅助函数：获取YouTube视频ID
function getYouTubeVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
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
