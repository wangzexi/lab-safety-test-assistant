require('dotenv').config()

const rp = require('request-promise')
const cheerio = require('cheerio')
const iconv = require('iconv-lite')
const delay = require('delay')
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const db = low(new FileSync('db.json'))
db.defaults({ questions: [] }).write()

const cookies = process.env.COOKIES

run()
async function run () {
  await crawl() // 自动反复进行模拟考试，并抓取题目
  console.log('🎉 抓取完成！上传 db.json 并更新 main.js 内题库地址即可使用。')
}

async function crawl () {
  let zeroCount = 0
  let oldCount = db.get('questions').value().length
  do {
    let body = await viewPracticeResultPage()
    const resultPageUri = 'http://121.192.191.91/' + /href="(.*?)">查看答卷/.exec(body)[1]
    body = await viewAnswerPage(resultPageUri)

    const questions = parseQuestions(body)

    console.log(questions.map((x) => x.content).join('\n'))

    db.get('questions').push(...questions).write()
    // 去重、排序
    db.set(
      'questions',
      db.get('questions')
        .uniqBy((x) => x.content + x.answers.join())
        .sortBy('content')
        .value()
    ).write()

    const newCount = db.get('questions').value().length
    console.log('获得新题', newCount - oldCount)
    console.log('已抓题目数', db.get('questions').value().length)
    console.log('连续零新增', zeroCount)

    await delay(10 * 1000) // 不要太快

    if (oldCount === newCount) {
      if (++zeroCount > 10) break // 连续十次次无新题，结束抓取
      continue
    }

    oldCount = newCount
    zeroCount = 0
  } while (true)
}

// 进入模拟考试、交白卷，返回练习结果页面
async function viewPracticeResultPage () {
  // 选择练习模式
  let res = await rp({
    uri: 'http://121.192.191.91/redir.php?catalog_id=6&cmd=kaoshi_chushih&kaoshih=504113&moshi=lianxi',
    method: 'GET',
    headers: {
      Cookie: cookies
    },
    simple: false,
    resolveWithFullResponse: true,
    encoding: null
  })

  // 载入练习页面首页
  res = await rp({
    uri: 'http://121.192.191.91/redir.php?catalog_id=6&cmd=dati',
    method: 'GET',
    headers: {
      Cookie: cookies
    },
    encoding: null
  })
  let body = iconv.decode(res, 'gb2312')

  // 提交白卷
  res = await rp({
    uri: 'http://121.192.191.91/redir.php?catalog_id=6&cmd=dati',
    method: 'POST',
    headers: {
      Cookie: cookies
    },
    form: {
      runpage: '0',
      page: '9',
      direction: '',
      tijiao: '1',
      postflag: '1',
      autosubmit: '0'
    },
    simple: false,
    resolveWithFullResponse: true,
    encoding: null
  })

  res = await rp({
    uri: 'http://121.192.191.91/redir.php?catalog_id=6&cmd=tijiao&mode=exam',
    method: 'GET',
    headers: {
      Cookie: cookies
    },
    encoding: null
  })
  body = iconv.decode(res, 'gb2312')

  return body
}

async function viewAnswerPage (uri) {
  const res = await rp({
    uri, // 'http://121.192.191.91/redir.php?catalog_id=6&cmd=dajuan_chakan&huihuabh=504844&mode=exam'
    method: 'GET',
    headers: {
      Cookie: cookies
    },
    encoding: null
  })
  const body = iconv.decode(res, 'gb2312')
  return body
}

// 解析模拟考试答卷查看页面
function parseQuestions (body) {
  const $ = cheerio.load(body)

  const questions = $('.shiti').map((i, el) => {
    const type = $(el).find('span').text().slice(1, -1)
    const content = $(el).find('strong').text()
    const allText = $(el).text()

    const re = /标准答案：\s+(.+?)\s/
    const result = re.exec(allText)
    if (!result) return // 为了简便，跳过已作答的、无标准答案的题

    let mark = result[1]

    let answers = []
    if (/判断题/.test(type)) {
      answers = ['对', '错']
      mark = { 正确: 'A', 错误: 'B' }[mark]
    }
    if (/单选题/.test(type)) {
      answers = $(el).find('ul').text().split('\n')
    }

    return {
      type,
      content,
      answers,
      mark
    }
  }).get()

  return questions
}
