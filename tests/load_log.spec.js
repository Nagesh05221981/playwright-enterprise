import {test,expect} from '@playwright/test'
test('has title',async({page})=>{
    await page.goto("http://localhost:8080/index.html")

    await expect(page).toHaveTitle(/NOVA/)

})
