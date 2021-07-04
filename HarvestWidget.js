// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: clock;
// version 1.5 | 2021-06-13
// eric.luce@proofgeist.com

let account_id, access_token, widget

if (!Keychain.contains("harvestAccountID") || !Keychain.contains("harvestAccessToken")) {
  if (config.runsInWidget) {
    // cannot show alerts, in widget, display the error widget instead
    let error = {
      "error": "Missing Credentials",
      "error_description": "Run this script first to setup your Harvest Credentials"
    }
    widget = await errorWidget(error)
    Script.setWidget(widget)
    Script.complete()
    return
  }
  
  let alert = new Alert()
  alert.title = "Missing Credentials"
  alert.message = "Enter your Harvest Credentials below."
  alert.addTextField("Account ID")
  alert.addSecureTextField("Access Token")
  alert.addAction("OK")
  alert.addCancelAction("Cancel")
  let result = await alert.present()
  if (result == -1) return // user cancel

  account_id = alert.textFieldValue(0)
  if (account_id == "") return // must not be empty

  access_token = alert.textFieldValue(1)
  if (access_token == "") return // must not be empty
  
  Keychain.set("harvestAccountID", account_id)
  Keychain.set("harvestAccessToken", access_token)
}

account_id = Keychain.get("harvestAccountID")
access_token = Keychain.get("harvestAccessToken")

// params are used for how many items to display and the spacing beteen them
// medium widget, I suggest 6,0 or 5,2
// large widget, I suggest 12,3 or 14,0
let params = args.widgetParameter
if (params === null) {
  params = "12,3"
}
params = params.split(",")
const limit = parseInt(params[0])
const spacing = parseInt(params[1])

let monday = getMonday(new Date())
let start = monday
let end = new Date(monday)
end.setDate(end.getDate() + 6);
let result = await loadItems(start, end)

if (result.error) {
  widget = await errorWidget(result)
  
} else {
  let items = result.results
  
  let weekTotal = items
  .map(item => item.total_hours)
  .reduce((a, b) => a + b, 0)
  .toFixed(2)
  
  items.sort((a,b) => (a.total_hours < b.total_hours) ? 1 : -1 )
  
  let defaultObj = {client_name: "", total_hours: 0}
  if (items.length > limit) {
   items = items.slice(0, limit)
  } else {
    let short = limit - items.length
    for (k = 0; k < short; k++) {
      items.push(defaultObj)
    }
  }
  
  widget = await createWidget(items, weekTotal)
}

if (config.runsInWidget) {
  // Tell the widget on the Home Screen to show our ListWidget instance.
  Script.setWidget(widget)
} else {
  // Present the widget preview
  if (limit <= 6) {
    widget.presentMedium()
  } else {
    widget.presentLarge()
  }
}
// Calling Script.complete() signals to Scriptable that the script have finished running.
// This can speed up the execution, in particular when running the script from Shortcuts or using Siri.
Script.complete()

async function createWidget(items, weekTotal) {
  let widget = new ListWidget()
  let gradient = new LinearGradient()
  gradient.locations = [0, 1]
  gradient.colors = [
    new Color("#f7992e"),
    new Color("#f56621"),
  ]
  widget.backgroundGradient = gradient
  
  // content
  let content = widget.addStack()
  content.layoutVertically()
  content.topAlignContent()
  
  for (i = 0; i < items.length; i++) {
    let item = items[i] 
    
    let stack = content.addStack()
    stack.centerAlignContent()
    if (item.client_name !== "") {
      let clientName = stack.addText(item.client_name)
      clientName.font = Font.semiboldSystemFont(18)
		clientName.color = Color.white()
      clientName.lineLimit = 1
      stack.addSpacer()
      let totalHours = stack.addText(item.total_hours.toString())
		totalHours.color = Color.white()
    } else {
      let clientName = stack.addText(" ")
      clientName.font = Font.semiboldSystemFont(18)
    }
    content.addSpacer(spacing)
  }
  
  // footer
  let footerStack = widget.addStack()
  footerStack.bottomAlignContent()
  let footerStackElements = []
  let weekOf = footerStack.addText("Week Total: " + weekTotal)
  footerStackElements.push(weekOf)
  
//  let weekOfDate = footerStack.addDate(start)
//  footerStackElements.push(weekOfDate)
//  weekOfDate.applyDateStyle()

  footerStack.addSpacer()
  
  let lastUpdatedText = footerStack.addText("Last updated ")
  footerStackElements.push(lastUpdatedText)

  let lastUpdatedDate = footerStack.addDate(new Date())
  footerStackElements.push(lastUpdatedDate)
  lastUpdatedDate.applyTimeStyle()
  
  for (key in footerStackElements) {
    // apply same styles to all text elements
    elm = footerStackElements[key]
    elm.font = Font.footnote()
    elm.textColor = Color.white()
    elm.textOpacity = 0.6
  }
  
  widget.addSpacer(2)
  
  return widget
}

async function errorWidget(result) {
  let code = result.error
  let desc = result.error_description
  
  let widget = new ListWidget()
  widget.backgroundColor = Color.lightGray()
  
  widget.addText(Script.name())
  widget.addText("⛔ " + code)
  widget.addText(desc)
  
  return widget
}

async function loadItems(start, end) {  
  start = formatDate(start)
  end = formatDate(end)
  let url = `https://api.harvestapp.com/v2/reports/time/clients?from=${start}&to=${end}`
  let json = await callHarvestAPI(url)
  return json
}

async function callHarvestAPI(url) {
  let req = new Request(url)
  req.headers = {"Harvest-Account-Id": account_id, "Authorization": "Bearer " + access_token}
  let json = await req.loadJSON()
  return json
}

function getMonday(d) {
  d = new Date();
  let day = d.getDay()
  let diff = d.getDate() - day + (day == 0 ? -6 : 1) // adjust when day is sunday
  return new Date(d.setDate(diff))
}

function formatDate(d) {
  let day = d.getDate()
  let month = d.getMonth() + 1
  let year = d.getFullYear()
  if (day < 10) day = "0" + day
  if (month < 10) month = "0" + month  
  return `${year}-${month}-${day}`
}

