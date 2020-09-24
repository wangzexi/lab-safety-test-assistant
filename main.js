(function () {
  fetch('https://raw.githubusercontent.com/wangzexi/lab-safety-test-assistant/master/src/db.json')
    .then(response => response.json())
    .then(data => solve(data.questions))

  function solve (questions) {
    let count = 0
    $('.shiti').each((_, el) => {
      const content = $(el).find('h3').text().replace(/\d+、/, '')
      const lis = $(el).find('li')
      const radios = $(el).find('input')

      const question = questions.find((x) => {
        const a = lis.text().replace(/\s/g, '')
        const b = x.answers.join('').replace(/\s/g, '')
        return x.content === content && a === b
      })
      if (!question) return console.log(`题库缺少：${content}`)

      const i = question.mark.charCodeAt(0) - 'A'.charCodeAt(0)
      radios[i].click()

      count++
    })
    console.log(`已经作答 ${count} 题！`)

    const next = $('input[value="下一页"]')
    if (next.length > 0 && count === 10) {
      next.get(0).scrollIntoView()
      next.click()
      return
    }

    console.log(`🎉 已至最后一页，请检查并提交！`)
  }
})()
