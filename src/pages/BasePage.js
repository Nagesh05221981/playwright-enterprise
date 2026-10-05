import {TestLogger} from '../logging/index.js'

export class BasePage {
    constructor (page,testinfo) {
        this.page = page 
        this.logger = new TestLogger (testinfo?.title || 'unknown')



    }
    // -----------Naviagtion -------
async navigate (path = '/'){
    this.logger.step(`Navigating to ${path}`)
    await this.page.goto(path)
    await this.page.waitForLoadState('domcontentloaded')
    this.logger.debug(`Navigation complete, URL: ${this.page.url()}`)

    
}

async getTitle(){
    const title = await this.page.title()
    this.logger.debug (`Page title: ${title}`)
    return title
}

async getUrl(){
    return this.page.url()
}

// -------- wait for pagrLoad -------

async waitForPageLoad(){
    this.logger.debug('waiting for pageload')
    await this.page.waitForLoadState('networkidle')
}

async waitForURL(urlPattern, options = {}) {
    this.logger.debug(`Waiting for URL matching: ${urlPattern}`)
    await this.page.waitForURL(urlPattern, options)
}

// ---- Element interactions (generic) ----

async click(locator, description = '') {
    this.logger.step(`Clicking: ${description || 'element'}`)
    await locator.click()
}

async fill(locator, value, description = '') {
    this.logger.step(`Filling "${description || 'field'}" with value`)
    await locator.fill(value)
}

async selectOption(locator, value, description = '') {
    this.logger.step(`Selecting "${value}" in ${description || 'dropdown'}`)
    await locator.selectOption(value)
}

async check(locator, description = '') {
    this.logger.step(`Checking: ${description || 'checkbox'}`)
    await locator.check()
}

async uncheck(locator, description = '') {
    this.logger.step(`Unchecking: ${description || 'checkbox'}`)
    await locator.uncheck()
}

async uploadFile(locator, filePath, description = '') {
    this.logger.step(`Uploading file: ${description || filePath}`)
    await locator.setInputFiles(filePath)
}

async clickAndWaitForNavigation(locator, description = '') {
    this.logger.step(`Clicking "${description || 'element'}" and waiting for navigation`)
    await Promise.all([
        this.page.waitForLoadState('domcontentloaded'),
        locator.click(),
    ])
}

// ---- Element state queries ----

async isElementVisible(locator) {
    return await locator.isVisible()
}

async isElementEnabled(locator) {
    return await locator.isEnabled()
}

async getTextContent(locator) {
    return await locator.textContent()
}

async getInputValue(locator) {
    return await locator.inputValue()
}

async getElementCount(locator) {
    return await locator.count()
}

async getAllTextContents(locator) {
    return await locator.allTextContents()
}

// ---- Screenshots ----

async takeScreenshot(name) {
    this.logger.info(`Taking screenshot: ${name}`)
    return await this.page.screenshot({
        path: `test-results/screenshots/${name}.png`,
        fullPage: true,
    })
}

// ---- Iframe support ----

getFrame(nameOrUrl) {
    this.logger.debug(`Switching to frame: ${nameOrUrl}`)
    return this.page.frameLocator(nameOrUrl)
}

// ---- Keyboard and mouse ----

async pressKey(key) {
    this.logger.debug(`Pressing key: ${key}`)
    await this.page.keyboard.press(key)
}

async hover(locator, description = '') {
    this.logger.debug(`Hovering: ${description || 'element'}`)
    await locator.hover()
}

}

