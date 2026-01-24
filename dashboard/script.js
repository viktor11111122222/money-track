const btn = document.getElementById("dropdownBtn");
const menu = document.getElementById("dropdownMenu");
const arrow = document.getElementById("arrow");
const selected = document.getElementById("selectedCategory");

let categories = ["Food", "Transport", "Rent", "Entertainment"];

function renderMenu() {
  menu.innerHTML = '';
  categories.forEach(cat => {
    const d = document.createElement('div');
    d.className = 'option';
    d.textContent = cat;
    menu.appendChild(d);
  });
  const add = document.createElement('div');
  add.className = 'option add-option';
  add.dataset.add = 'true';
  add.textContent = '+ Add category';
  menu.appendChild(add);
}

renderMenu();

btn.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = menu.style.display === "block";
  menu.style.display = isOpen ? "none" : "block";
  arrow.style.transform = isOpen ? "rotate(0deg)" : "rotate(180deg)";
});

// event delegation for menu
menu.addEventListener('click', (e) => {
  const opt = e.target.closest('.option');
  if (!opt) return;
  // Add category flow
  if (opt.dataset.add === 'true') {
    showAddForm();
    return;
  }

  // select category
  selected.textContent = opt.textContent;
  menu.style.display = 'none';
  arrow.style.transform = 'rotate(0deg)';
});

function showAddForm() {
  menu.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'add-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'New category name';
  input.className = 'add-input';
  input.style.padding = '10px';
  input.style.width = '100%';
  input.style.marginBottom = '8px';

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';

  const save = document.createElement('button');
  save.textContent = 'Save';
  save.className = 'add-save';
  save.style.flex = '1';

  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.className = 'add-cancel';
  cancel.style.flex = '1';

  actions.appendChild(save);
  actions.appendChild(cancel);
  wrapper.appendChild(input);
  wrapper.appendChild(actions);
  menu.appendChild(wrapper);

  input.focus();

  save.addEventListener('click', () => {
    const v = input.value.trim();
    if (!v) return;
    if (!categories.includes(v)) categories.push(v);
    renderMenu();
    selected.textContent = v;
    menu.style.display = 'none';
    arrow.style.transform = 'rotate(0deg)';
  });

  cancel.addEventListener('click', () => {
    renderMenu();
  });
}

// close when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown")) {
    menu.style.display = "none";
    arrow.style.transform = "rotate(0deg)";
  }
});
