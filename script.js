console.log("Script loaded");

// 地址必须填写，代表着大模型的版本号！！！！！！！！！！！！！！！！
let httpUrl = new URL("https://spark-api.xf-yun.com/v3.1/chat");
let modelDomain; // V1.1-V3.5动态获取，高于以上版本手动指定
//APPID，APISecret，APIKey在https://console.xfyun.cn/services/cbm这里获取
const APPID = 'e53f85a0'
const API_SECRET = 'YzYzYmZlNmZjY2VhMDE5OGUyYTBkZDA5'
const API_KEY = '84fdaa3c3349de64070b53d7c7e34f8f'

var total_res = "";

function toggleTheme() {
    $('body').toggleClass('dark-mode');
    const isDarkMode = $('body').hasClass('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    $('#theme-toggle i').toggleClass('fa-moon fa-sun');
}

function getWebsocketUrl() {
    console.log("Getting WebSocket URL");
    // 动态获取domain信息
    switch (httpUrl.pathname) {
        case "/v1.1/chat":
            modelDomain = "general";
            break;
        case "/v2.1/chat":
            modelDomain = "generalv2";
            break;
        case "/v3.1/chat":
            modelDomain = "generalv3";
            break;
        case "/v3.5/chat":
            modelDomain = "generalv3.5";
            break;
    }

    return new Promise((resolve, reject) => {
        var apiKey = API_KEY
        var apiSecret = API_SECRET

        var url = 'wss://' + httpUrl.host + httpUrl.pathname
        var host = location.host
        var date = new Date().toGMTString()
        var algorithm = 'hmac-sha256'
        var headers = 'host date request-line'
        var signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${httpUrl.pathname} HTTP/1.1`
        var signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret)
        var signature = CryptoJS.enc.Base64.stringify(signatureSha)
        var authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`
        var authorization = btoa(authorizationOrigin)
        url = `${url}?authorization=${authorization}&date=${date}&host=${host}`
        console.log("WebSocket URL:", url);
        resolve(url)
    })
}

class TTSRecorder {
    constructor({
        appId = APPID
    } = {}) {
        this.appId = appId
        this.status = 'init'
        // 移除 this.messageId = 0
    }

    // 修改状态
    setStatus(status) {
        console.log("Status changed to:", status);
        this.onWillStatusChange && this.onWillStatusChange(this.status, status)
        this.status = status
    }

    // 连接websocket
    connectWebSocket() {
        this.setStatus('ttsing')
        return getWebsocketUrl().then(url => {
            let ttsWS
            if ('WebSocket' in window) {
                ttsWS = new WebSocket(url)
            } else if ('MozWebSocket' in window) {
                ttsWS = new MozWebSocket(url)
            } else {
                alert('浏览器不支持WebSocket')
                return
            }
            this.ttsWS = ttsWS
            ttsWS.onopen = e => {
                console.log("WebSocket connected");
                this.webSocketSend()
            }
            ttsWS.onmessage = e => {
                console.log("Received message:", e.data);
                this.result(e.data)
            }
            ttsWS.onerror = e => {
                console.error("WebSocket error:", e);
                this.setStatus('error')
                alert('WebSocket报错，请f12查看详情')
            }
            ttsWS.onclose = e => {
                console.log("WebSocket closed:", e);
                this.setStatus('init')
            }
        }).catch(error => {
            console.error("Error connecting to WebSocket:", error);
            this.setStatus('error');
            alert('连接WebSocket时出错，请检查网络连接');
        })
    }

    // websocket发送数据
    webSocketSend() {
        console.log("Sending WebSocket data");
        const userMessage = $('#user-input').val().trim();
        if (!userMessage) {
            console.log("Empty message, not sending");
            return;
        }
        var params = {
            "header": {
                "app_id": this.appId,
                "uid": "fd3f47e4-d"
            },
            "parameter": {
                "chat": {
                    "domain": modelDomain,
                    "temperature": 0.5,
                    "max_tokens": 1024
                }
            },
            "payload": {
                "message": {
                    "text": [{
                        "role": "user",
                        "content": userMessage
                    }]
                }
            }
        }
        // 移除 messageId 字段
        console.log("Params being sent:", JSON.stringify(params));
        try {
            this.ttsWS.send(JSON.stringify(params));
            console.log("Message sent successfully");
        } catch (error) {
            console.error("Error sending message:", error);
        }
        
        // 清空用户输入
        $('#user-input').val('');
    }

    start() {
        console.log("Starting TTS");
        total_res = ""; // 清空回答历史
        this.messageId++ // 增加消息ID
        this.connectWebSocket()
    }

    // 修改 result 方法
    result(resultData) {
        console.log("Raw result data:", resultData);
        let jsonData;
        try {
            jsonData = JSON.parse(resultData);
            console.log("Parsed data:", jsonData);
        } catch (error) {
            console.error("Error parsing result data:", error);
            return;
        }

        if (jsonData.header.code !== 0) {
            console.error(`提问失败: ${jsonData.header.code}:${jsonData.header.message}`);
            alert(`提问失败: ${jsonData.header.code}:${jsonData.header.message}`)
            this.setStatus("init");
            return
        }
        
        if (jsonData.payload && jsonData.payload.choices && jsonData.payload.choices.text && jsonData.payload.choices.text.length > 0) {
            let aiResponse = jsonData.payload.choices.text[0].content;
            total_res += aiResponse;
            
            let aiMessageElement = $('#chat-container .ai-message').last();
            if (aiMessageElement.length === 0 || jsonData.header.status === 2) {
                let currentTime = new Date().toLocaleTimeString();
                $('#chat-container').append(`
                    <div class="message ai-message">
                        ${total_res}
                        <span class="message-time">${currentTime}</span>
                        <button class="copy-button" title="复制回复"><i class="far fa-copy"></i></button>
                    </div>
                `);
            } else {
                aiMessageElement.html(`
                    ${total_res}
                    <span class="message-time">${new Date().toLocaleTimeString()}</span>
                    <button class="copy-button" title="复制回复"><i class="far fa-copy"></i></button>
                `);
            }
            $('#chat-container').scrollTop($('#chat-container')[0].scrollHeight);
        }
        
        if (jsonData.header.status === 2) {
            this.ttsWS.close()
            this.setStatus("init")
            total_res = "";
        }
    }
}

$(document).ready(function() {
    console.log("Document ready");
    
    // 检查本地存储中的主题设置
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        $('body').addClass('dark-mode');
        $('#theme-toggle i').removeClass('fa-moon').addClass('fa-sun');
    }

    // 主题切换按钮点击事件
    $('#theme-toggle').click(toggleTheme);

    let bigModel = new TTSRecorder()
    bigModel.onWillStatusChange = function (oldStatus, status) {
        console.log("Status changing from", oldStatus, "to", status);
        // 可以在这里进行页面中一些交互逻辑处理：按钮交互等
        // 按钮中的文字
        let btnState = {
            init: '发送',
            ttsing: '回答中...'
        }
        $('#send-button')  // 修改这里，使用 #send-button
            .removeClass(oldStatus)
            .addClass(status)
            .text(btnState[status])
    }

    $('#send-button').click(function () {  // 修改这里，使用 #send-button
        console.log("Send button clicked");
        if (['init', 'endPlay', 'errorTTS'].indexOf(bigModel.status) > -1) {
            const userMessage = $('#user-input').val().trim();
            if (userMessage) {
                let currentTime = new Date().toLocaleTimeString();
                $('#chat-container').append(`
                    <div class="message user-message">
                        ${userMessage}
                        <span class="message-time">${currentTime}</span>
                    </div>
                `);
                $('#chat-container').scrollTop($('#chat-container')[0].scrollHeight);
                bigModel.start()
            } else {
                console.log("Empty message, not sending");
            }
        } else {
            console.log("Cannot send message, current status:", bigModel.status);
        }
    })

    $("#user-input").on('keypress', function(e) {
        if (e.which === 13 && !e.shiftKey) {
            e.preventDefault();
            $('#send-button').click();
        }
    });

    // 清空聊天记录
    $('#clear-button').click(function() {
        $('#chat-container').empty();
    });

    // 复制AI回复
    $(document).on('click', '.copy-button', function() {
        let messageText = $(this).parent().clone().children().remove().end().text().trim();
        navigator.clipboard.writeText(messageText).then(function() {
            alert('回复已复制到剪贴板');
        }, function(err) {
            console.error('无法复制文本: ', err);
        });
    });
});