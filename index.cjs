let session, SNlM0e;

 const init = async (sessionID) => {
    session = {
        baseURL: "https://gemini.google.com",
        headers: {
            Host: "gemini.google.com",
            "X-Same-Domain": "1",
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            Origin: "https://gemini.google.com",
            Referer: "https://gemini.google.com/",
            Cookie: `__Secure-1PSID=${sessionID};`,
        },
    };

    const response = await fetch("https://gemini.google.com/", {
        method: "GET",
        headers: session.headers,
        credentials: "include",
    });

    const data = await response.text();

    const match = data.match(/SNlM0e":"(.*?)"/);

    if (match) SNlM0e = match[1];
    else throw new Error("Could not get Google Bard.");

    return SNlM0e;
};

 const queryBard = async (message, ids = {}) => {
    if (!SNlM0e)
        throw new Error("Make sure to call Bard.init(SESSION_ID) first.");

    // Parameters and POST data
    const params = {
        bl: "boq_assistant-bard-web-server_20230711.08_p0",
        _reqID: ids._reqID ? `${ids._reqID}` : "0",
        rt: "c",
    };

    const messageStruct = [
        [message],
        null,
        ids ? Object.values(ids).slice(0, 3) : [null, null, null],
    ];

    const data = {
        "f.req": JSON.stringify([null, JSON.stringify(messageStruct)]),
        at: SNlM0e,
    };

    let url = new URL(
        "/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate",
        session.baseURL
    );

    Object.keys(params).forEach((key) =>
        url.searchParams.append(key, params[key])
    );

    let formBody = [];

    for (let property in data) {
        let encodedKey = encodeURIComponent(property);
        let encodedValue = encodeURIComponent(data[property]);
        formBody.push(encodedKey + "=" + encodedValue);
    }

    formBody = formBody.join("&");

    const response = await fetch(url.toString(), {
        method: "POST",
        headers: session.headers,
        body: formBody,
        credentials: "include",
    });

    const responseData = await response.text();

    const chatData = JSON.parse(responseData.split("\n")[3])[0][2];

    // Check if there is data
    if (!chatData) {
        throw new Error(`Google Bard encountered an error ${responseData}.`);
    }

    // Get important data, and update with important data if set to do so
    const parsedChatData = JSON.parse(chatData);
    const bardResponseData = JSON.parse(chatData)[4][0];

    let text = bardResponseData[1][0];

    let images = bardResponseData[4]?.map((x) => {
        return {
            tag: x[2],
            url: x[3][0][0],
            source: {
                original: x[0][0][0],
                website: x[1][0][0],
                name: x[1][1],
                favicon: x[1][3]
            }
        };
    });

    return {
        content: formatMarkdown(text, images),
        images: images,
        ids: {
            // Make sure kept in order, because using Object.keys() to query above
            conversationID: parsedChatData[1][0],
            responseID: parsedChatData[1][1],
            choiceID: parsedChatData[4][0][0],
            _reqID: parseInt(ids._reqID ?? 0) + 100000,
        },
    };
};

const formatMarkdown = (text, images) => {
    if (!images) return text;

    for (let imageData of images) {
        const formattedTag = `!${imageData.tag}(${imageData.url
            })`;
        text = text.replace(new RegExp("(?<!\!)" + imageData.tag.replace("[", "\\[").replace("]", "\\]")), formattedTag);

    }

    return text;
};

 const askAI = async (message, useJSON = false) => {
    if (useJSON) return await queryBard(message);
    else return (await queryBard(message)).content;
};

 class Chat {
    constructor(ids) {
        this.ids = ids;
    }

    async ask(message, useJSON = false) {
        let request = await queryBard(message, this.ids);
        this.ids = { ...request.ids };
        if (useJSON) return request;
        else return request.content;
    }

    export () {
        return this.ids;
    }
}

module.exports = { init, askAI, Chat };
