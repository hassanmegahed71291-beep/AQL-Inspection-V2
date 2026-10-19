(function(){
  if (window.AQLAcademy) return;

  const DATA_URL = './src/data/aql-definitions.json';

  async function loadData(){
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load academy data');
    return res.json();
  }

  function renderCard(item){
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.style.padding = '16px';
    wrap.innerHTML = `
      <h3>${item.title}</h3>
      <p>${item.content}</p>
    `;
    return wrap;
  }

  function showFlashcards(data){
    const view = document.getElementById('view') || document.body;
    view.innerHTML = '';

    const holder = document.createElement('div');
    holder.style.display = 'grid';
    holder.style.gap = '12px';

    let index = 0;
    const cards = data.cards || [];

    const setCard = () => {
      holder.innerHTML = '';
      const item = cards[index % cards.length];
      holder.appendChild(renderCard(item));
    };

    const ctrl = document.createElement('div');
    ctrl.style.display = 'flex';
    ctrl.style.gap = '8px';
    ctrl.style.marginTop = '8px';

    const prev = document.createElement('button');
    prev.className = 'btn';
    prev.textContent = 'Prev';
    prev.onclick = () => { index = (index - 1 + cards.length) % cards.length; setCard(); };

    const next = document.createElement('button');
    next.className = 'btn p';
    next.textContent = 'Next';
    next.onclick = () => { index = (index + 1) % cards.length; setCard(); };

    ctrl.append(prev, next);
    view.appendChild(holder);
    view.appendChild(ctrl);
    setCard();
  }

  function renderGlossary(data){
    const view = document.getElementById('view') || document.body;
    const glossary = document.createElement('div');
    glossary.className = 'card';
    glossary.style.padding = '16px';
    glossary.innerHTML = '<h3>AQL Glossary</h3>';

    const list = document.createElement('ul');
    (data.glossary || []).forEach((item) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${item.term}</strong>: ${item.definition}`;
      list.appendChild(li);
    });

    glossary.appendChild(list);
    view.appendChild(glossary);
  }

  async function renderAcademyPage(){
    try {
      const data = await loadData();
      const view = document.getElementById('view') || document.body;
      view.innerHTML = '';

      const root = document.createElement('div');
      root.style.display = 'grid';
      root.style.gap = '16px';

      const flashcards = document.createElement('div');
      flashcards.className = 'card';
      flashcards.style.padding = '16px';
      flashcards.innerHTML = '<h3>MicroLearning — Academy</h3><p>Quick AQL review cards.</p>';
      root.appendChild(flashcards);

      const ctrl = document.createElement('div');
      ctrl.style.display = 'flex';
      ctrl.style.gap = '8px';
      ctrl.style.marginTop = '8px';

      const flashBtn = document.createElement('button');
      flashBtn.className = 'btn p';
      flashBtn.textContent = 'Open Flashcards';
      flashBtn.onclick = () => showFlashcards(data);

      const glossaryBtn = document.createElement('button');
      glossaryBtn.className = 'btn';
      glossaryBtn.textContent = 'Open Glossary';
      glossaryBtn.onclick = () => {
        const view = document.getElementById('view') || document.body;
        view.innerHTML = '';
        renderGlossary(data);
      };

      ctrl.append(flashBtn, glossaryBtn);
      root.appendChild(ctrl);
      view.appendChild(root);
    } catch (e) {
      console.warn('AQLAcademy render failed', e);
      const view = document.getElementById('view') || document.body;
      view.innerHTML = '<div class="card"><h3>Academy unavailable</h3><p>Could not load the AQL definitions file.</p></div>';
    }
  }

  window.AQLAcademy = {
    loadData,
    renderAcademyPage,
    showFlashcards,
    renderGlossary
  };

  window.addEventListener('hashchange', () => {
    if (location.hash === '#/academy') renderAcademyPage();
  });
})();
