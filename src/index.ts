import { Gift } from './types'

(() => {
  window.setGift = (gift: Gift) => {
    let html = `
      <p class="msg">${gift.message}</p>
    `

    let assets = ''
    ;(gift.native ? [gift.native] : []).concat(gift.erc20 || []).forEach(a => {
      assets += `<li><label>${a.symbol}:</label>${a.amount}</li>`
    })
    if (assets) {
      assets = `<ul class="assets">${assets}</ul>`
      html += assets
    }

    html += `
      <div class="meta">
        <p class="from"><label>from:</label><em>${gift.sender}</em></p>
        <p class="to"><label>to:</label><em>${gift.receiver}</em></p>
        <p class="date">${new Date(gift.datetime).toUTCString()}</p>
      </div>
    `

    document.getElementById('details').innerHTML = html
  }

  window.addEventListener('mousemove', e => {
    const details = document.getElementById('details')
    const logo = document.getElementById('logo')

    if (e.pageX < details.offsetLeft) {
      (logo.getElementsByClassName('left')[0] as HTMLElement).style.opacity = '1';
      (logo.getElementsByClassName('mid')[0] as HTMLElement).style.opacity = '0';
      (logo.getElementsByClassName('right')[0] as HTMLElement).style.opacity = '0';
    } else if (e.pageX > (details.offsetLeft + details.offsetWidth)) {
      (logo.getElementsByClassName('left')[0] as HTMLElement).style.opacity = '0';
      (logo.getElementsByClassName('mid')[0] as HTMLElement).style.opacity = '0';
      (logo.getElementsByClassName('right')[0] as HTMLElement).style.opacity = '1';
    } else {
      (logo.getElementsByClassName('left')[0] as HTMLElement).style.opacity = '0';
      (logo.getElementsByClassName('mid')[0] as HTMLElement).style.opacity = '1';
      (logo.getElementsByClassName('right')[0] as HTMLElement).style.opacity = '0';
    }
  })
})()
