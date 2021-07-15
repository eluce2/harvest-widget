
// version 1.5 | 2021-06-13
// eric.luce@proofgeist.com

let forceDownload = config.runsInApp
forceDownload = false // DEV ONLY (use local copy)

class HarvestWidget {
  constructor(require, options={}) {
    // must pass in the require function to this script to avoid recursive imports
    this.require = require
    let defaultOptions = {
      mode: 'client' //or project
    }
    this.options = Object.assign(defaultOptions, options)
    this.api = undefined
    this._ = undefined
  }
  async setup() {
    if (this.api === undefined) {
      let Harvest = await this.require({
          moduleName: "scriptable-harvest-api", forceDownload,
          url: "https://raw.githubusercontent.com/eluce2/harvest-widget/main/HarvestApi.js"
      });
      this.api = new Harvest()
    }
    await this.api.initCreds()
    if (this._ === undefined) {
      this._ = await this.require({
        moduleName: "lodash",
        url: "https://unpkg.com/lodash/lodash.min.js"
      })
    }
  }
  async create() {
    await this.setup()

    let params = args.widgetParameter
    if (params === null) {
      params = "12,3"
    }
    params = params.split(",")
    this.limit = parseInt(params[0])
    this.spacing = parseInt(params[1])

    let monday = getMonday(new Date())
    let start = monday
    let end = new Date(monday)
    let widget
    end.setDate(end.getDate() + 6);
    try {
      let result = await this.api.getMyTimeEntries(start, end)

      let weekTotal = this._.sumBy(result, 'hours').toFixed(2)

      let type = this.options.mode
      let items = []
      let grouped = this._.groupBy(result, `${type}.id`)
      let sumBy = this._.sumBy
      this._.each(Object.keys(grouped), function(id) {
        let rows = grouped[id]
        let client_name = rows[0][type].name
        let total_hours = parseFloat(sumBy(rows, 'hours').toFixed(2))
        items.push({ client_name, total_hours })
      })
      
      items = this._.sortBy(items, 'total_hours').reverse()
      
      
      if (items.length > this.limit) {
        items = this._.take(items, this.limit)
      } else {
        let defaultObj = {client_name: "", total_hours: 0}
        let short = this.limit - items.length
        for (let k = 0; k < short; k++) {
          items.push(defaultObj)
        }
      }
      
      widget = await this.returnWidget(items, weekTotal)
    } catch(e) {
      console.error(e)
      widget = await this.errorWidget(result)
    }

    if (config.runsInWidget) {
      // Tell the widget on the Home Screen to show our ListWidget instance.
      Script.setWidget(widget)
    } else {
      // Present the widget preview
      if (this.limit <= 6) {
        widget.presentMedium()
      } else {
        widget.presentLarge()
      }
    }
  }

  async returnWidget(items, weekTotal) {
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
    
    for (let i = 0; i < items.length; i++) {
      let item = items[i] 
      
      let stack = content.addStack()
      stack.centerAlignContent()
      if (item.client_name !== "") {
        let clientName = stack.addText(item.client_name)
        clientName.font = Font.semiboldSystemFont(18)
        clientName.lineLimit = 1
        stack.addSpacer()
        let totalHours = stack.addText(item.total_hours.toString())
        totalHours.color = Color.white()
      } else {
        let clientName = stack.addText(" ")
        clientName.font = Font.semiboldSystemFont(18)
      }
      clientName.color = Color.white()
      content.addSpacer(this.spacing)
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
    
    let key, elm
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
  async loadItems(start, end) {}

  async errorWidget(result) {
    let code = result.error
    let desc = result.error_description
    
    let widget = new ListWidget()
    widget.backgroundColor = Color.lightGray()
    
    widget.addText(Script.name())
    widget.addText("⛔ " + code)
    widget.addText(desc)
    
    return widget
  }
}
function getMonday(d) {
  d = new Date();
  let day = d.getDay()
  let diff = d.getDate() - day + (day == 0 ? -6 : 1) // adjust when day is sunday
  return new Date(d.setDate(diff))
}

module.exports = HarvestWidget