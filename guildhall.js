//TODO: EMBED PARSER VERSION NUMBER SO WE CAN DYNAMICALLY SWAP IN THE CASE OF A FUTURE UPGRADE


function getPoster(postElement){
	return postElement.querySelector('.user-uname').textContent.trim()						//Grab username and remove leading/trailing spaces and newlines
}

function getCurrentUser(){
	const userElement = document.querySelector('span.glyphicon.glyphicon-user')
	let username = ''
	if(userElement){
		username = userElement.closest('a').textContent.trim()
	}
	return username
}

const currentUser = getCurrentUser()

function createSwitcher(accountsList){
	let profileButtons = document.querySelector('span.glyphicon.glyphicon-user')
	
	if(!profileButtons){
		return
	}
	let logoutButton = document.querySelector('input[value="Logout"]')							//Get logout button
	logoutButton.parentNode.action = '#'
	logoutButton.parentNode.method = 'get'
	logoutButton.onclick = function(){sendMessage({'action':'logout'})}
	profileButtons = profileButtons.closest('.btn-group')
	const accountDropdown = document.createElement('button')
	accountDropdown.classList = 'btn btn-default navbar-btn dropdown'
	accountDropdown.innerText = '▼'
	accountDropdown.onclick = function(){showAccounts()}
	profileButtons.appendChild(accountDropdown)
	const accountsElement = document.createElement('div')
	accountsElement.classList = 'dropdown-content'
	accountsElement.id = 'accountsElement'
	accountDropdown.appendChild(accountsElement)
	for(const accountSwap of accountsList){
		if(accountSwap === currentUser.toLowerCase()){
			continue
		}
		let firstAccount = document.createElement('a')
		firstAccount.href = '#'
		firstAccount.innerText = accountSwap
		firstAccount.onclick = function(){swapAccount(accountSwap)}
		accountsElement.appendChild(firstAccount)
	}
}


function showAccounts() {
  document.getElementById("accountsElement").classList.toggle("show");
}




let showRevisions = function(){
	let postContainers = document.querySelectorAll('[id^="post-"]')
	for(const post of postContainers){
		let id = Number(post.id.substring(5))														//Grab the post ID attribute and cut out the post- part (post-79246923)
		if(!id){
			continue																				//Ignore anything that isn't a post
		}
		const posterName = getPoster(post)															//Grab username and remove leading/trailing spaces and newlines
		const timeStampContainer = post.querySelector('span.pull-left')
		if (posterName === currentUser && timeStampContainer.querySelector('span.glyphicon')){		//If this is our post and it's been edited
			let revisionsButton = document.createElement('a');										//Revisions button
			revisionsButton.href = 'https://www.roleplayerguild.com/posts/' + id + '/revisions'
			revisionsButton.innerText = 'Revs'
			timeStampContainer.appendChild(revisionsButton)		//Add to the post timing/revisions text
		}
	}
}

let darkMode = function(){
	for (const forumElement of document.querySelectorAll('.forum-item')){
		forumElement.style.setProperty('background-color', '#000000')													//Main forum colors
	}
	for(const body of document.querySelectorAll('body')){
		body.style.setProperty('background-color', '#000000', 'important')												//Make main background black
		body.style.color = "#FFFFFF"																					//Make main text white
	}	
	for (const breadcrumb of document.querySelectorAll('.breadcrumb')){
		breadcrumb.style.backgroundColor = "#000000"																	//Make header with forum directory	
	}		
	for(const panelHeader of document.querySelectorAll('.panel-heading')){												//Make posts black
		panelHeader.style.backgroundColor = "#3c3c3c"
	}
	for(const panelBody of document.querySelectorAll('.panel-body')){
		panelBody.style.backgroundColor = "#000000"
	}
	for(const panelFooter of document.querySelectorAll('.panel-footer')){
		panelFooter.style.backgroundColor = "#000000"
	}
	for(const contentBox of document.querySelectorAll('.well')){														//Input textbox background and reactions
		contentBox.style.backgroundColor = "#000000"
	}
	for (const navbar of document.querySelectorAll('.navbar-inverse')){
		navbar.style.backgroundImage = "linear-gradient(180deg,#3c3c3c 0,#000000)"										//Top bar	
	}	
	for (const cheatsheet of document.querySelectorAll('#bbcode-cheatsheet')){
		cheatsheet.style.backgroundColor = "#000000"																	//Cheat Sheet
	}	
	for (const inputBack of document.querySelectorAll('.md-preview, textarea')){
		inputBack.style.setProperty('background-color', '#000000', 'important')											//Input background
	}
//	for (const linkColor of document.querySelectorAll('a')){
//		linkColor.style.setProperty('color', '#FFFFFF')																	//a href colors
//	}
	for (const buttonElement of document.querySelectorAll('.btn')){
		buttonElement.style.setProperty('color', '#FFFFFF')																//Links within buttons can stay white
	}
	for (const panelElement of document.querySelectorAll('.panel-heading')){
		for (const buttonElement of panelElement.querySelectorAll('a')){
			buttonElement.style.setProperty('color', '#FFFFFF')															//Links within post preview headers can stay white
		}
	}
}
//TODO: Make links change color with style sheet, not with setting the element CSS. This breaks the new BBCode parsing since it injects HTML attributes
let lightMode = function(){
	for (const forumElement of document.querySelectorAll('.forum-item')){
		forumElement.style.setProperty('background-color', '#ECE8DD')												//Main forum colors
	}
	for(const body of document.querySelectorAll('body')){
		body.style.setProperty('background-color', '#E1D7C6', 'important')											//Make header with forum directory	
		body.style.color = "#000000"																				//Make main text	
	}	
	for (const breadcrumb of document.querySelectorAll('.breadcrumb')){
		breadcrumb.style.backgroundColor = "#F8F4EA"																//Make header with forum directory	
	}		
	for(const panelHeader of document.querySelectorAll('.panel-heading')){											//Post contents
		panelHeader.style.backgroundColor = "#579BB1"
	}
	for(const panelBody of document.querySelectorAll('.panel-body')){
		panelBody.style.backgroundColor = "#ECE8DD"
	}
	for(const panelFooter of document.querySelectorAll('.panel-footer')){
		panelFooter.style.backgroundColor = "#ECE8DD"
	}
	for(const contentBox of document.querySelectorAll('.well')){														//Input textbox background and reactions
		contentBox.style.backgroundColor = "#E1D7C6"
	}
	for (const navbar of document.querySelectorAll('.navbar-inverse')){
		navbar.style.backgroundImage = "linear-gradient(180deg,#579BB1 0,#E1D7C6)"										//Top bar	
	}	
	for (const cheatsheet of document.querySelectorAll('#bbcode-cheatsheet')){
		cheatsheet.style.backgroundColor = "#E1D7C6"																	//Cheat Sheet
	}	
	for (const inputBack of document.querySelectorAll('.md-preview, textarea')){
		inputBack.style.setProperty('background-color', '#ECE8DD', 'important')											//Input background
	}
//	for (const linkColor of document.querySelectorAll('a')){
//		linkColor.style.setProperty('color', '#579BB1')																	//a href colors
//	}
	for (const buttonElement of document.querySelectorAll('.btn')){
		buttonElement.style.setProperty('color', '#FFFFFF')																//Links within buttons can stay white
	}
	for (const panelElement of document.querySelectorAll('.panel-heading')){
		for (const buttonElement of panelElement.querySelectorAll('a')){
			buttonElement.style.setProperty('color', '#FFFFFF')															//Links within post preview headers can stay white
		}
	}
}
let classicMode = function(){																						//ONLY use on edit profile page. Doesn't look BAD on other pages, but it's imperfect.
	for (const forumElement of document.querySelectorAll('.forum-item')){
		forumElement.style.setProperty('background-color', '#3d3a3a')												//Main forum colors
	}
	for(const body of document.querySelectorAll('body')){
		body.style.setProperty('background-color', '#222020', 'important')											//Make header with forum directory	
		body.style.color = "#FFFFFF"																				//Make main text	
	}	
	for (const breadcrumb of document.querySelectorAll('.breadcrumb')){
		breadcrumb.style.backgroundColor = "#3d3a3a"																//Make header with forum directory	
	}		
	for(const panelHeader of document.querySelectorAll('.panel-heading')){											//Post contents
		panelHeader.style.backgroundColor = "#262626"
	}
	for(const panelBody of document.querySelectorAll('.panel-body')){
		panelBody.style.backgroundColor = "#3d3a3a"
	}
	for(const panelFooter of document.querySelectorAll('.panel-footer')){
		panelFooter.style.backgroundColor = "#7a7575"
	}
	for(const contentBox of document.querySelectorAll('.well')){														//Input textbox background and reactions
		contentBox.style.backgroundColor = "#222"
	}
	for (const navbar of document.querySelectorAll('.navbar-inverse')){
		navbar.style.backgroundImage = "linear-gradient(180deg,#3c3c3c 0,#222)"											//Top bar	
	}	
	for (const cheatsheet of document.querySelectorAll('#bbcode-cheatsheet')){
		cheatsheet.style.backgroundColor = "#222"																		//Cheat Sheet
	}	
	for (const inputBack of document.querySelectorAll('.md-preview, textarea')){
		inputBack.style.setProperty('background-color', '#2e2c2c', 'important')											//Input background
	}
//	for (const linkColor of document.querySelectorAll('a')){
//		linkColor.style.setProperty('color', '#ffc300')																	//a href colors
//	}
	for (const buttonElement of document.querySelectorAll('.btn')){
		buttonElement.style.setProperty('color', '#e5e5e5')																//Links within buttons reset yellow
	}
	for (const panelElement of document.querySelectorAll('.panel-heading')){
		for (const buttonElement of panelElement.querySelectorAll('a')){
			buttonElement.style.setProperty('color', '#e5e5e5')															//Links within post preview headers reset yellow
		}
	}
	for (const navElement of document.querySelectorAll('.navbar-nav')){
		for (const buttonElement of navElement.querySelectorAll('a')){
			buttonElement.style.setProperty('color', '#9d9d9d')															//Fix navbar links to original color
		}
	}
}



function displayThemeSwitcher(currentTheme){
	const template = document.querySelector('a[name="gender"]').nextElementSibling					//Grab a similar elementFromPoint
	let switcher = template.cloneNode(true)															//Clone it
	switcher.querySelector('.panel-footer').remove()												//Remove save button
	switcher.querySelector('.panel-heading').innerText = 'Site Theme'								//Remove save button
	
	const labelSelector = switcher.querySelectorAll('label')
	for(const label of labelSelector){
		label.classList.remove('active')
		const logo = label.querySelector('img') || false
		logo ? logo.remove() : ""																	//Remove icons for custom class
	}
	for(const inputButton of switcher.querySelectorAll('input')){									//Uncheck radio buttons
		inputButton.removeAttribute('checked')
		inputButton.removeAttribute('value')
	}
	const DARK = 0
	const CLASSIC = 1
	const LIGHT = 2
	let themeIndex = CLASSIC																		//Default to standard Guild
	currentTheme === 'dark' ? themeIndex = DARK : ""												//Set dark and ligfht modes
	currentTheme === 'light' ? themeIndex = LIGHT : ""												//Set dark and light modes
	
	labelSelector[DARK].childNodes[2].textContent = 'Dark'											//Changing the text to the modes
	labelSelector[DARK].onclick = function(){darkMode(); setTheme('dark')}
	labelSelector[CLASSIC].childNodes[3].textContent = 'Classic'									//Swap to 3 because of a quirk with the first option not having an image that we removed
	labelSelector[CLASSIC].onclick = function(){classicMode(); setTheme('classic')}
	labelSelector[LIGHT].childNodes[3].textContent = 'Light'
	labelSelector[LIGHT].onclick = function(){lightMode(); setTheme('light')}
	
	labelSelector[themeIndex].classList.add('active')
	
	template.parentNode.insertBefore(switcher, template.nextSibling)
}

function swapAccount(accountName){
	sendMessage({"action":"setCookie", "name":accountName}	)
}

function sendMessage(messageObject){
	chrome.runtime.sendMessage(JSON.stringify(messageObject)).then((ignore) => {
		return
	})
}

function initializeBackgroundScript(){
	sendMessage({'action':'initialize'})
}

function linkAccount(username){
	sendMessage({'action':'rememberCookie', 'name':username})
}

function unlinkAccount(username){
	sendMessage({'action':'forgetCookie', 'name':username})
}


function convertUnlinkButton(linkButton, user){
	linkButton.className = 'btn btn-danger'
	linkButton.textContent = 'Unlink Account'
	linkButton.onclick = function(){unlinkAccount(user); convertLinkButton(linkButton, user)}
}

function refreshPage(){
	window.location.reload();
}
	

function convertLinkButton(linkButton, user){
	linkButton.className = 'btn btn-success'
	linkButton.textContent = 'Link Account'
	linkButton.onclick = function(){linkAccount(user); convertUnlinkButton(linkButton, user)}
}

function displayAccountSwitcherButton(rememberedAccounts){																//TODO
	const pageUser = getUsernameOnProfilePage().toLowerCase()
	const switcherDiv = document.createElement('div');
	switcherDiv.className = 'pull-right'
	switcherDiv.style.setProperty('margin-right', '10px')
	switcherDiv.style.setProperty('display', 'inline-block')
	let switcherButton = document.createElement('button');																//Switching button
	if (rememberedAccounts.includes(pageUser.toLowerCase())){															//Option to forget account
		switcherButton.className = 'btn btn-danger'
		switcherButton.textContent = 'Unlink Account'
		switcherButton.onclick = function(){unlinkAccount(pageUser); convertLinkButton(switcherButton, pageUser)}
	}
	else{																												//Otherwise allow them to unblock
		switcherButton.className = 'btn btn-success'
		switcherButton.textContent = 'Link Account'
		switcherButton.onclick = function(){linkAccount(pageUser); convertUnlinkButton(switcherButton, pageUser)}
	}
	switcherDiv.appendChild(switcherButton)
	const userButtons = document.querySelector('.page-header').querySelectorAll('.pull-right')							//Get user buttons
	userButtons[userButtons.length - 1].parentNode.insertBefore(switcherDiv, userButtons[userButtons.length - 1].nextSibling)	//Add new block button
}

function applyChanges(){
	initializeBackgroundScript()
	let bbcodeScript = document.createElement('script');														//Inject new BBCode Editor
	bbcodeScript.src = chrome.runtime.getURL('bbCodeExtension.js');
	bbcodeScript.onload = function() {
		this.remove();
	};
	(document.head || document.documentElement).appendChild(bbcodeScript);
	showRevisions()																					//Safe to show on any page
	processBlockedUsers(getBlockedUsers())															//Safe to show on any page
	if(getTheme() === 'light'){
		lightMode()
	}
	else if(getTheme() === 'dark'){
		darkMode()
	}
	
	const path = window.location.pathname
	const userPath = '/users/' + currentUser.toLowerCase().replace(' ', '-')						//Account for space to - conversion
	if(path.startsWith('/users/') && (path !== userPath)){											//We're either on our profile or someone else's, but not a subdirectory of ours (e.g. /edit)
		displayBlockButton()																		//We're on someone else's page
	}
	if(path === userPath + '/edit'){																//Editing our own profile
		displayThemeSwitcher(getTheme())
	}
}

applyChanges()


function revealPost(clickedButton){
	clickedButton.closest('.post').className = 'panel panel-default post hidden-post  expanded-post '					//Expand post
	clickedButton.querySelector('span.glyphicon').className = 'glyphicon glyphicon-minus'								//Swap to minus button
	clickedButton.onclick = function(){hidePost(clickedButton)}															//Allow buttons to hide blocked contents
}

function hidePost(clickedButton){
	clickedButton.closest('.post').className = 'panel panel-default post hidden-post '									//Expand post
	clickedButton.querySelector('span.glyphicon').className = 'glyphicon glyphicon-plus'								//Swap to plus button
	clickedButton.onclick = function(){revealPost(clickedButton)}														//Allow buttons to reveal blocked contents
}

function getLinkedAccounts(){
	if(!getStorage('linkedAccounts')){
		updateStorage('linkedAccounts', {})
	}
	return JSON.parse(getStorage('linkedAccounts'))
}

function setLinkedAccounts(accountsObject){
	updateStorage('linkedAccounts', accountsObject)
}

function getTheme(){
	if(!getStorage('theme')){
		updateStorage('theme', 'classic')
	}
	return JSON.parse(getStorage('theme'))
}

function setTheme(theme){
	updateStorage('theme', theme)
}
//TODO: CHROME STORAGE API. We may need to do async stuff sadface
function getStorage(key){
	return localStorage.getItem(key)
}

function updateStorage(key, value){
	localStorage.setItem(key, JSON.stringify(value))
}

function updateBlockedUsers(key, blockSet){																		//Have to process sets differently because of course we do
	updateStorage(key, Array.from(blockSet))
}

function getBlockedUsers(){
	const blockedData = getStorage('blockedUsers') || '[]'
	return new Set(JSON.parse(blockedData))																				//Load or create blocked user list
	//TODO: SET THIS TO chrome.storage API ONCE WE LAUNCH EXTENSION
}

function blockUser(username){
	const blockedUsers = getBlockedUsers()
	blockedUsers.add(username)
	updateBlockedUsers('blockedUsers', blockedUsers)
}

function unblockUser(username){
	const blockedUsers = getBlockedUsers()
	blockedUsers.delete(username)
	updateBlockedUsers('blockedUsers', blockedUsers)
}

function processBlockedUsers(blockedUsers){
	const allPostContainers = document.querySelectorAll('.post')														//Get all posts
	for(const post of allPostContainers){																				//Iterate through each
		if (blockedUsers.has(getPoster(post).toLowerCase())){															//If user is blocked
			post.className = 'panel panel-default post hidden-post '													//Hide post using Guild's existing hiding system.
			const role = post.querySelector('div.user-role')															//Label user as blocked and make it red
			role.textContent = 'Blocked'
			role.style.color = 'red'
			const revealButton = post.querySelector('button.collapser')													//Get  blocked post button
			revealButton.onclick = function(){revealPost(revealButton)}													//Allow buttons to reveal blocked contents
		}
	}

}



function getUsernameOnProfilePage(){
	if(window.location.pathname.substring(0, 7) !== '/users/'){															//Make sure we're actually on the profile page
		return null
	}
	return window.location.pathname.substring(7).replaceAll('-', ' ')													//Exclude /users/, replace dash with space, and return
}

function convertBlockButton(blockButton, user){
	blockButton.className = 'btn btn-danger'
	blockButton.textContent = 'Block User'
	blockButton.onclick = function(){blockUser(user); convertUnblockButton(blockButton, user)}
}

function convertUnblockButton(blockButton, user){
	blockButton.className = 'btn btn-success'
	blockButton.textContent = 'Unblock User'
	blockButton.onclick = function(){unblockUser(user); convertBlockButton(blockButton, user)}
}


function displayBlockButton(){
	blockedUsers = getBlockedUsers()
	const blockDiv = document.createElement('div');
	blockDiv.className = 'pull-right'
	blockDiv.style.setProperty('margin-right', '10px')
	blockDiv.style.setProperty('display', 'inline-block')
	let blockButton = document.createElement('button');																	//Revisions button
	const pageUser = getUsernameOnProfilePage()
	if (!blockedUsers.has(pageUser.toLowerCase())){																		//Option to block if user isn't on list
		blockButton.className = 'btn btn-danger'
		blockButton.textContent = 'Block User'
		blockButton.onclick = function(){blockUser(pageUser); convertUnblockButton(blockButton, pageUser)}
	}
	else{																												//Otherwise allow them to unblock
		blockButton.className = 'btn btn-success'
		blockButton.textContent = 'Unblock User'
		blockButton.onclick = function(){unblockUser(pageUser); convertBlockButton(blockButton, pageUser)}
	}
	blockDiv.appendChild(blockButton)
	const userButtons = document.querySelector('.page-header').querySelectorAll('.pull-right')							//Get user buttons
	userButtons[userButtons.length - 1].parentNode.insertBefore(blockDiv, userButtons[userButtons.length - 1].nextSibling)	//Add new block button
}
function initializeAccountLinker(accountsList){
	const path = window.location.pathname
	if(path === '/users/' + currentUser.toLowerCase().replace(' ', '-')){												//Account for - in usernames with spaces
		displayAccountSwitcherButton(accountsList)															//Displays "Remember/Forget This Account"
	}
	createSwitcher(accountsList)
}

 chrome.runtime.onMessage.addListener(function(request, sender) {														//Receive refresh event
	 const messageContent = JSON.parse(request)
	 if(messageContent['action'] === 'refresh'){
		refreshPage()
	 }
	 else if(messageContent['action'] === 'setSwitcher'){
		const accountsList = messageContent['accounts']
		initializeAccountLinker(accountsList)
	 }
	 else if(messageContent['action'] === 'setBlocker'){
		const blockedAccountsList = JSON.parse(messageContent['accounts'])
		processBlockedUsers(blockedAccountsList)
	 }
});

	


