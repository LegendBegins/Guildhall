function rememberCookie(username, cookieName, url){
	chrome.cookies.get({'name':cookieName, 'url':url}).then((cookie) => {
		chrome.storage.sync.get(['linkedAccounts']).then((result) => {
			const accountString = result['linkedAccounts'] || '{}'
			let accountDict = JSON.parse(accountString)
			accountDict[username] = cookie.value
			chrome.storage.sync.set({'linkedAccounts':JSON.stringify(accountDict)}).then((ignore) => {
				return
			})
		})
	})
}
function forgetCookie(username){
	chrome.storage.sync.get(['linkedAccounts']).then((result) => {
		const accountString = result['linkedAccounts'] || '{}'
		let accountDict = JSON.parse(accountString)
		delete accountDict[username]
		chrome.storage.sync.set({'linkedAccounts':JSON.stringify(accountDict)}).then((ignore) => {
			return
		})
	})
}

function setSessionIdFromStorage(username, cookieName, url){
	chrome.storage.sync.get(['linkedAccounts']).then((result) => {
		const accountString = result['linkedAccounts'] || '{}'
		let accountDict = JSON.parse(accountString)
		if(username in accountDict){
			chrome.cookies.set({'name':cookieName, 'url':url, value:accountDict[username]}).then((ignore) => {
				broadcastRefresh()
			})
		}
	})
}

function deleteSessionId(cookieName, url){
	chrome.cookies.remove({'name':cookieName, 'url':url}).then((ignore) => {
		broadcastRefresh()
	})
}

function getLinkedAccounts(){
	chrome.storage.sync.get(['linkedAccounts']).then((result) => {
		const accountString = result['linkedAccounts'] || '{}'
		let accountDict = JSON.parse(accountString)
		sendMessage({'action':'setSwitcher', 'accounts':Object.keys(accountDict)})
	})
}

function getBlockedAccounts(){
	chrome.storage.sync.get(['blockedAccounts']).then((result) => {
		const accountString = result['blockedAccounts'] || '[]'
		let accountList = JSON.parse(accountString)
		sendMessage({'action':'setBlocker', 'accounts':accountList})
	})
}
function setBlockedAccount(username){
	chrome.storage.sync.get(['blockedAccounts']).then((result) => {
		const accountString = result['blockedAccounts'] || '[]'
		let accountList = JSON.parse(accountString)
		accountList.push(username)
		chrome.storage.sync.set({'blockedAccounts':JSON.stringify(accountList)}).then((ignore) => {
			return
		})
	})
}

function broadcastRefresh(){
	sendMessage({'action':'refresh'})
}

function sendMessage(messageObject){
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		chrome.tabs.sendMessage(tabs[0].id, JSON.stringify(messageObject));
	});
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) { 
    const messageContent = JSON.parse(request)
	const domain = 'https://www.roleplayerguild.com'
	if(messageContent['action'] === 'rememberCookie'){
		rememberCookie(messageContent['name'], 'sessionId', domain)
	}
	else if(messageContent['action'] === 'forgetCookie'){
		forgetCookie(messageContent['name'])
	}
	else if(messageContent['action'] === 'setCookie'){
		setSessionIdFromStorage(messageContent['name'], 'sessionId', domain)
	}
	else if(messageContent['action'] === 'logout'){
		deleteSessionId('sessionId', domain)
	}
	else if(messageContent['action'] === 'block'){
		setBlockedAccount(messageContent['name'])
	}
	else if(messageContent['action'] === 'initialize'){
		getLinkedAccounts()
	}
});

