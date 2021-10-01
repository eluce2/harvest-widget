// version 1.5 | 2021-06-13
// eric.luce@proofgeist.com

let forceDownload = config.runsInApp;
//forceDownload = false // DEV ONLY (use local copy)

const dayGoal = 7;
const weekGoal = 35;

class HarvestWidget {
  constructor(require, options = {}) {
    // must pass in the require function to this script to avoid recursive imports
    this.require = require;
    let defaultOptions = {
      mode: "project", //or client
    };
    this.options = Object.assign(defaultOptions, options);
    this.api = undefined;
    this._ = undefined;
  }
  async setup() {
    if (this.api === undefined) {
      let Harvest = await this.require({
        moduleName: "scriptable-harvest-api",
        forceDownload,
        url: "https://raw.githubusercontent.com/eluce2/harvest-widget/main/HarvestApi.js",
      });
      this.api = new Harvest();
    }
    await this.api.initCreds();
    if (this._ === undefined) {
      this._ = await this.require({
        moduleName: "lodash",
        url: "https://unpkg.com/lodash/lodash.min.js",
      });
    }
  }
  async create() {
    await this.setup();

    let params = args.widgetParameter;
    if (params === null) {
      params = "12,3";
    }
    params = params.split(",");
    this.limit = parseInt(params[0]);
    this.spacing = parseInt(params[1]);

    let monday = getMonday(new Date());
    let start = monday;
    let end = new Date(monday);
    let widget;
    end.setDate(end.getDate() + 6);
    try {
      let result = await this.api.getMyTimeEntries(start, end);
      let weekTotal = this._.sumBy(result, "hours").toFixed(2);

      let d = new Date();
      let dayFilter = this._.filter(result, (o) => {
        let dateString = d.toISOString().slice(0, 10);
        // console.log(dateString);
        return dateString == o.spent_date;
      });
      let dayTotal = this._.sumBy(dayFilter, "hours").toFixed(2);

      widget = await this.returnWidget(dayTotal, weekTotal);
    } catch (e) {
      console.error(e);
      widget = await this.errorWidget(result);
    }

    if (config.runsInWidget) {
      // Tell the widget on the Home Screen to show our ListWidget instance.
      Script.setWidget(widget);
    } else {
      // Present the widget preview
      widget.presentMedium();
    }
  }

  async returnWidget(dayTotal, weekTotal) {
    dayTotal = parseFloat(dayTotal);
    weekTotal = parseFloat(weekTotal);

    let widget = new ListWidget();
    let gradient = new LinearGradient();
    gradient.locations = [0, 1];
    gradient.colors = [new Color("#ab3a8a"), new Color("#89216B")];
    widget.backgroundGradient = gradient;

    let d = new Date();
    let day = d.getDay();
    if (day == 6) day = 5; //ignore saturdays
    let canvasWidth = 300;
    let progressBarHeight = 25;
    let widgetText;

    // day progress
    let content = widget.addStack();
    content.layoutVertically();
    content.centerAlignContent();
    content.spacing = 4;

    let textBar = content.addStack();
    textBar.centerAlignContent();

    let dayGoalMet = dayGoal <= dayTotal;
    let text = dayGoalMet
      ? `${convertTime(dayTotal - dayGoal)} ahead`
      : `${convertTime(dayGoal - dayTotal)} behind`;
    widgetText = textBar.addText(text);
    widgetText.color = Color.white();
    text = `Day Total: ${convertTime(dayTotal)}`;
    textBar.addSpacer();
    widgetText = textBar.addText(text);
    widgetText.color = Color.white();

    let drawContext = new DrawContext();
    drawContext.size = new Size(canvasWidth, progressBarHeight);
    drawContext.opaque = false;
    drawProgerss({
      x: 0,
      y: 0,
      length: canvasWidth,
      height: progressBarHeight,
      color: Color.darkGray(),
      progressColor: dayGoalMet ? Color.green() : Color.yellow(),
      percent: dayTotal / dayGoal,
    });

    let cImage = drawContext.getImage();

    let wImage = content.addImage(cImage);
    wImage.centerAlignImage();
    wImage.resizable = false;

    content.addSpacer(2);

    // week progress
    textBar = content.addStack();
    textBar.centerAlignContent();

    let weekProgressGoal = day * dayGoal;

    let weekProgressGoalMet = weekProgressGoal <= weekTotal;
    text = weekProgressGoalMet
      ? `${convertTime(weekTotal - weekProgressGoal)} ahead`
      : `${convertTime(weekProgressGoal - weekTotal)} behind`;
    console.log(
      convertTime(weekProgressGoal - weekTotal),
      convertTime(weekTotal)
    );
    widgetText = textBar.addText(text);
    widgetText.color = Color.white();

    text = `Week Total: ${convertTime(weekTotal)}`;
    textBar.addSpacer();
    widgetText = textBar.addText(text);
    widgetText.color = Color.white();

    drawContext = new DrawContext();
    drawContext.size = new Size(canvasWidth, progressBarHeight);
    drawContext.opaque = false;
    drawProgerss({
      x: 0,
      y: 0,
      length: canvasWidth,
      height: progressBarHeight,
      color: Color.darkGray(),
      progressColor: weekProgressGoalMet ? Color.green() : Color.yellow(),
      percent: weekTotal / weekGoal,
      segmentLabels: ["7", "14", "21", "28"],
    });

    cImage = drawContext.getImage();

    wImage = content.addImage(cImage);
    wImage.centerAlignImage();
    wImage.resizable = false;

    // footer
    widget.addSpacer();
    let footerStack = widget.addStack();
    footerStack.bottomAlignContent();
    let footerStackElements = [];

    footerStack.addSpacer();

    let lastUpdatedText = footerStack.addText("Last updated ");
    footerStackElements.push(lastUpdatedText);

    let lastUpdatedDate = footerStack.addDate(new Date());
    footerStackElements.push(lastUpdatedDate);
    lastUpdatedDate.applyTimeStyle();

    footerStack.addSpacer();

    let key, elm;
    for (key in footerStackElements) {
      // apply same styles to all text elements
      elm = footerStackElements[key];
      elm.font = Font.footnote();
      elm.textColor = Color.white();
      elm.textOpacity = 0.6;
    }

    function drawProgerss({
      x,
      y,
      length,
      height,
      color = Color.darkGray(),
      progressColor = Color.green(),
      segmentColor = Color.lightGray(),
      segmentLabels = [],
      percent,
    }) {
      let path;

      // draw background of bar
      if (percent > 1) percent = 1;
      path = new Path();
      path.move(new Point(x, y));
      path.addRoundedRect(
        new Rect(x, y, length, height),
        height / 4,
        height / 4
      );
      drawContext.addPath(path);
      drawContext.setFillColor(color);
      drawContext.fillPath();

      // filled portion of bar
      path = new Path();
      path.move(new Point(x, y));
      path.addRoundedRect(
        new Rect(x, y, length * percent, height),
        height / 4,
        height / 4
      );
      drawContext.addPath(path);
      drawContext.setFillColor(progressColor);
      drawContext.fillPath();

      // draw segments
      drawContext.setTextAlignedCenter();
      for (let i = 0; i < segmentLabels.length; i++) {
        let segmentX = (length / (segmentLabels.length + 1)) * (i + 1);
        let segmentHeight = y + height + 8;
        path = new Path();
        path.move(new Point(segmentX, y));
        path.addLine(new Point(segmentX, segmentHeight));
        drawContext.addPath(path);
        drawContext.setStrokeColor(segmentColor);
        drawContext.setLineWidth(1);
        drawContext.strokePath();

        let textWidth = 40;
        drawContext.setFont(Font.title3());
        drawContext.drawTextInRect(
          segmentLabels[i],
          new Rect(segmentX - textWidth / 2, segmentHeight + 3, textWidth, 100)
        );
      }
    }

    return widget;
  }
  async loadItems(start, end) {}

  async errorWidget(result) {
    let code = result.error;
    let desc = result.error_description;

    let widget = new ListWidget();
    widget.backgroundColor = Color.lightGray();

    widget.addText(Script.name());
    widget.addText("⛔ " + code);
    widget.addText(desc);

    return widget;
  }
}
function getMonday(d) {
  d = new Date();
  let day = d.getDay();
  let diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
  return new Date(d.setDate(diff));
}
function convertTime(decimal) {
  var hours = Math.floor(decimal);
  var minutes = Math.floor(parseFloat((decimal - hours).toFixed(2)) * 60);
  if (minutes < 10) minutes = `0${minutes}`;
  return hours + ":" + minutes;
}

module.exports = HarvestWidget;
