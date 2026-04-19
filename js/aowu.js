async function getLocalInfo(ext) {
    return jsonify({
        ver: 20240413,
        name: 'aowu',
        site: 'https://www.aowu.tv'
    });
}

const cheerio = createCheerio()
const CryptoJS = createCryptoJS()

const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

let appConfig = {
    ver: 20240413,
    title: 'aowu',
    site: 'https://www.aowu.tv',
    tabs: [
        {
            name: '新番',
            ext: {
                type: 20,
            },
        },
        {
            name: '番剧',
            ext: {
                type: 21,
            },
        },
        {
            name: '剧场',
            ext: {
                type: 22,
            },
        },
    ],
}

async function getConfig() {
    return jsonify(appConfig)
}

async function getCards(ext) {
    ext = argsify(ext)
    let cards = []
    let { type, page = 1 } = ext

    const url = 'https://www.aowu.tv/index.php/ds_api/vod'
    const time = Math.round(new Date() / 1000)
    const key = md5('DS' + time + 'DCC147D11943AF75')
    const body = {
        type: type,
        class: '',
        area: '',
        lang: '',
        version: '',
        state: '',
        letter: '',
        page: page,
        time: time,
        key: key,
    }

    const { data } = await $fetch.post(url, body, {
        headers: {
            'User-Agent': UA,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    })

    const cardList = argsify(data).list
    cardList.forEach((e) => {
        let name = e.vod_name
        let pic = e.vod_pic
        let remarks = e.vod_remarks
        let id = e.vod_id
        cards.push({
            vod_id: id.toString(),
            vod_name: name,
            vod_pic: pic,
            vod_remarks: remarks || '',
            ext: {
                url: appConfig.site + e.url,
            },
        })
    })

    return jsonify({
        list: cards,
    })
}

async function getTracks(ext) {
    ext = argsify(ext)
    let list = []
    let url = ext.url

    // 先请求页面，可能返回 cookie 验证
    let resp = await $fetch.get(url, {
        headers: {
            'User-Agent': UA,
        },
    })
    
    let data = resp.data
    
    // 检查是否需要 cookie 验证
    if (data.includes('fl_js_validator') && data.includes('document.cookie')) {
        // 从响应中提取 cookie
        let cookieMatch = data.match(/document\.cookie\s*=\s*"([^"]+)"/)
        if (cookieMatch) {
            let cookieStr = cookieMatch[1]
            // 添加随机参数避免缓存
            let sep = url.includes('?') ? '&' : '?'
            let noCacheUrl = url + sep + '_t=' + Date.now()
            // 带上 cookie 重新请求
            resp = await $fetch.get(noCacheUrl, {
                headers: {
                    'User-Agent': UA,
                    'Cookie': cookieStr,
                },
            })
            data = resp.data
        }
    }
    
    // 检查是否是 JSON 字符串形式的 HTML
    if (typeof data === 'string' && data.startsWith('"') && data.endsWith('"')) {
        try {
            data = JSON.parse(data)
        } catch (e) {
            // 如果解析失败，保持原样
        }
    }

    const $ = cheerio.load(data)

    try {
        let from = []
        $('.anthology-tab .swiper-slide').each((i, e) => {
            let name = $(e).clone().children('i, span').remove().end().text().trim()
            let count = $(e).find('.badge').text().trim()
            from.push(`${name}(${count})`)
        })

        $('.anthology-list-box').each((i, e) => {
            const play_from = from[i]
            let videos = $(e).find('li a')
            let tracks = []
            videos.each((i, e) => {
                const name = $(e).text()
                const href = $(e).attr('href')
                tracks.push({
                    name: name,
                    pan: '',
                    ext: {
                        url: `${appConfig.site}${href}`,
                    },
                })
            })
            list.push({
                title: play_from,
                tracks,
            })
        })
    } catch (error) {
        $print(error)
    }

    return jsonify({
        list: list,
    })
}

async function getPlayinfo(ext) {
    ext = argsify(ext)
    let url = ext.url

    // 先请求页面，可能返回 cookie 验证
    let resp = await $fetch.get(url, {
        headers: {
            'User-Agent': UA,
        },
    })
    
    let data = resp.data
    
    // 检查是否需要 cookie 验证
    if (data.includes('fl_js_validator') && data.includes('document.cookie')) {
        // 从响应中提取 cookie
        let cookieMatch = data.match(/document\.cookie\s*=\s*"([^"]+)"/)
        if (cookieMatch) {
            let cookieStr = cookieMatch[1]
            // 添加随机参数避免缓存
            let sep = url.includes('?') ? '&' : '?'
            let noCacheUrl = url + sep + '_t=' + Date.now()
            // 带上 cookie 重新请求
            resp = await $fetch.get(noCacheUrl, {
                headers: {
                    'User-Agent': UA,
                    'Cookie': cookieStr,
                },
            })
            data = resp.data
        }
    }
    
    // 检查是否是 JSON 字符串形式的 HTML
    if (typeof data === 'string' && data.startsWith('"') && data.endsWith('"')) {
        try {
            data = JSON.parse(data)
        } catch (e) {
            // 如果解析失败，保持原样
        }
    }

    try {
        const $ = cheerio.load(data)
        const config = JSON.parse($('script:contains(player_)').html().replace('var player_aaaa=', ''))
        let purl = config.url
        if (config.encrypt == 2) purl = unescape(base64Decode(purl))
        const artPlayer = appConfig.site + `/player/?url=${purl}`
        
        // 请求播放器页面，也需要处理 cookie 验证
        let artResp = await $fetch.get(artPlayer, {
            headers: {
                'User-Agent': UA,
                Referer: url,
            },
        })
        
        let artRes = artResp.data
        
        // 检查播放器页面是否需要 cookie 验证
        if (artRes && artRes.includes('fl_js_validator') && artRes.includes('document.cookie')) {
            let cookieMatch = artRes.match(/document\.cookie\s*=\s*"([^"]+)"/)
            if (cookieMatch) {
                let cookieStr = cookieMatch[1]
                let sep = artPlayer.includes('?') ? '&' : '?'
                let noCacheUrl = artPlayer + sep + '_t=' + Date.now()
                artResp = await $fetch.get(noCacheUrl, {
                    headers: {
                        'User-Agent': UA,
                        'Cookie': cookieStr,
                        Referer: url,
                    },
                })
                artRes = artResp.data
            }
        }

        if (artRes) {
            function decryptAES(ciphertext, key) {
                try {
                    const rawData = CryptoJS.enc.Base64.parse(ciphertext)
                    const iv = CryptoJS.lib.WordArray.create(rawData.words.slice(0, 4))
                    const encrypted = CryptoJS.lib.WordArray.create(rawData.words.slice(4))
                    const decrypted = CryptoJS.AES.decrypt({ ciphertext: encrypted }, CryptoJS.enc.Utf8.parse(key), {
                        iv: iv,
                        mode: CryptoJS.mode.CBC,
                        padding: CryptoJS.pad.Pkcs7,
                    })
                    return decrypted.toString(CryptoJS.enc.Utf8)
                } catch (e) {
                    $print(e)
                    return null
                }
            }
            
            let sessionKeyMatch = artRes.match(/const sessionKey\s=\s"([^"]+)"/)
            let encryptedUrlMatch = artRes.match(/const encryptedUrl\s=\s"([^"]+)"/)
            
            if (sessionKeyMatch && encryptedUrlMatch) {
                const sessionKey = sessionKeyMatch[1]
                const encryptedUrl = encryptedUrlMatch[1]
                const realUrl = decryptAES(encryptedUrl, sessionKey)
                return jsonify({ urls: [realUrl] })
            }
        }
    } catch (error) {
        $print(error)
    }

    return jsonify({ urls: [] })
}

async function search(ext) {
    try {
        ext = argsify(ext)
        let cards = []
        let text = encodeURIComponent(ext.text || ext.wd || '')
        let page = ext.page || 1
        
        // 使用 API 搜索
        const time = Math.round(new Date() / 1000)
        const key = CryptoJS.MD5('DS' + time + 'DCC147D11943AF75').toString()
        
        const body = `wd=${text}&page=${page}&time=${time}&key=${key}`
        
        let resp = await $fetch.post('https://www.aowu.tv/index.php/ds_api/vod', body, {
            headers: {
                'User-Agent': UA,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        })
        
        let data = resp.data
        
        // 检查是否需要 cookie 验证
        if (data.includes('fl_js_validator') && data.includes('document.cookie')) {
            let cookieMatch = data.match(/document\.cookie\s*=\s*"([^"]+)"/)
            if (cookieMatch) {
                let cookieStr = cookieMatch[1]
                resp = await $fetch.post('https://www.aowu.tv/index.php/ds_api/vod', body, {
                    headers: {
                        'User-Agent': UA,
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cookie': cookieStr,
                    },
                })
                data = resp.data
            }
        }
        
        try {
            let result = JSON.parse(data)
            if (result.list && result.list.length > 0) {
                result.list.forEach((e) => {
                    cards.push({
                        vod_id: e.vod_id.toString(),
                        vod_name: e.vod_name,
                        vod_pic: e.vod_pic,
                        vod_remarks: e.vod_remarks || '',
                        ext: {
                            url: appConfig.site + e.url,
                        },
                    })
                })
            }
        } catch (e) {
            $print('JSON parse error:', e)
        }
        
        return jsonify({
            list: cards,
        })
    } catch (error) {
        $print(error)
        return jsonify({list: []})
    }
}

function generatePHPSESSID() {
    const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const length = 26
    let sessionId = ''

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length)
        sessionId += characters[randomIndex]
    }

    return sessionId
}

function md5(text) {
    return CryptoJS.MD5(text).toString()
}

function base64Decode(text) {
    return CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(text))
}
