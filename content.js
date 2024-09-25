import $ from "jquery";

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

async function createOverlayPlayer() {
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

  //请求视频字幕信息
  const videoId = getYouTubeVideoId();
  console.log('视频ID:', videoId);
  const langOptionsWithLink = await getLangOptionsWithLink(videoId);
  console.log('字幕信息:', langOptionsWithLink);
  if (!langOptionsWithLink) {
    console.log('没有字幕信息');
      // noTranscriptionAlert();
      return;
  }

  const transcriptHTML = await getTranscriptHTML(langOptionsWithLink[0].link, videoId);
  console.log('字幕HTML:', transcriptHTML);

}

// 辅助函数：获取YouTube视频ID
function getYouTubeVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

async function getLangOptionsWithLink(videoId) {
  // Get a transcript URL
  const videoPageResponse = await fetch("https://www.youtube.com/watch?v=" + videoId);
  const videoPageHtml = await videoPageResponse.text();
  const splittedHtml = videoPageHtml.split('"captions":')

  if (splittedHtml.length < 2) { return; } // No Caption Available

  const captions_json = JSON.parse(splittedHtml[1].split(',"videoDetails')[0].replace('\n', ''));
  const captionTracks = captions_json.playerCaptionsTracklistRenderer.captionTracks;
  const languageOptions = Array.from(captionTracks).map(i => { return i.name.simpleText; })
  
  const first = "English"; // Sort by English first
  languageOptions.sort(function(x,y){ return x.includes(first) ? -1 : y.includes(first) ? 1 : 0; });
  languageOptions.sort(function(x,y){ return x == first ? -1 : y == first ? 1 : 0; });

  return Array.from(languageOptions).map((langName, index) => {
    const link = captionTracks.find(i => i.name.simpleText === langName).baseUrl;
    return {
      language: langName,
      link: link
    }
  })
}

async function getTranscriptHTML(link, videoId) {

  const rawTranscript = await getRawTranscript(link);

  const scriptObjArr = [], timeUpperLimit = 60, charInitLimit = 300, charUpperLimit = 500;
  let loop = 0, chars = [], charCount = 0, timeSum = 0, tempObj = {}, remaining = {};

  // Sum-up to either total 60 seconds or 300 chars.
  Array.from(rawTranscript).forEach((obj, i, arr) => {

      // Check Remaining Text from Prev Loop
      if (remaining.start && remaining.text) {
          tempObj.start = remaining.start;
          chars.push(remaining.text);
          remaining = {}; // Once used, reset to {}
      }

      // Initial Loop: Set Start Time
      if (loop == 0) {
          tempObj.start = (remaining.start) ? remaining.start : obj.start;
      }

      loop++;

      const startSeconds = Math.round(tempObj.start);
      const seconds = Math.round(obj.start);
      timeSum = (seconds - startSeconds);
      charCount += obj.text.length;
      chars.push(obj.text);

      if (i == arr.length - 1) {
          tempObj.text = chars.join(" ").replace(/\n/g, " ");
          scriptObjArr.push(tempObj);
          resetNums();
          return;
      }

      if (timeSum > timeUpperLimit) {
          tempObj.text = chars.join(" ").replace(/\n/g, " ");
          scriptObjArr.push(tempObj);
          resetNums();
          return;
      }

      if (charCount > charInitLimit) {

          if (charCount < charUpperLimit) {
              if (obj.text.includes(".")) {

                  const splitStr = obj.text.split(".");

                  // Case: the last letter is . => Process regulary
                  if (splitStr[splitStr.length-1].replace(/\s+/g, "") == "") {
                      tempObj.text = chars.join(" ").replace(/\n/g, " ");
                      scriptObjArr.push(tempObj);
                      resetNums();
                      return;
                  }

                  // Case: . is in the middle
                  // 1. Get the (length - 2) str, then get indexOf + str.length + 1, then substring(0,x)
                  // 2. Create remaining { text: str.substring(x), start: obj.start } => use the next loop
                  const lastText = splitStr[splitStr.length-2];
                  const substrIndex = obj.text.indexOf(lastText) + lastText.length + 1;
                  const textToUse = obj.text.substring(0,substrIndex);
                  remaining.text = obj.text.substring(substrIndex);
                  remaining.start = obj.start;

                  // Replcae arr element
                  chars.splice(chars.length-1,1,textToUse)
                  tempObj.text = chars.join(" ").replace(/\n/g, " ");
                  scriptObjArr.push(tempObj);
                  resetNums();
                  return;

              } else {
                  // Move onto next loop to find .
                  return;
              }
          }

          tempObj.text = chars.join(" ").replace(/\n/g, " ");
          scriptObjArr.push(tempObj);
          resetNums();
          return;

      }

  })

  return Array.from(scriptObjArr).map(obj => {
      const t = Math.round(obj.start);
      const hhmmss = convertIntToHms(t);
      return  `<div class="yt_ai_summary_transcript_text_segment">
                  <div><a class="yt_ai_summary_transcript_text_timestamp" style="padding-top: 16px !important;" href="/watch?v=${videoId}&t=${t}s" target="_blank" data-timestamp-href="/watch?v=${videoId}&t=${t}s" data-start-time="${t}">${hhmmss}</a></div>
                  <div class="yt_ai_summary_transcript_text" data-start-time="${t}">${obj.text}</div>
              </div>`
  }).join("");

  function resetNums() {
      loop = 0, chars = [], charCount = 0, timeSum = 0, tempObj = {};
  }
}

async function getRawTranscript(link) {

  // Get Transcript
  const transcriptPageResponse = await fetch(link); // default 0
  const transcriptPageXml = await transcriptPageResponse.text();

  // Parse Transcript
  const jQueryParse = $.parseHTML(transcriptPageXml);
  const textNodes = jQueryParse[1].childNodes;

  return Array.from(textNodes).map(i => {
    return {
      start: i.getAttribute("start"),
      duration: i.getAttribute("dur"),
      text: i.textContent
    };
  });

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
