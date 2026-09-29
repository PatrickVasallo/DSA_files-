// Data storage
  let items = [];
  let nextId = 1;

  let restockRequests = [];
  let nextRequestId = 1;

  const inventoryBody = document.getElementById('inventoryBody');
  const restockBody = document.getElementById('restockBody');
  const inventoryMsg = document.getElementById('inventoryMsg');
  const restockNotice = document.getElementById('restockNotice');

  // Edit stock elements
  const editOverlay = document.getElementById('editOverlay');
  const editForm = document.getElementById('editForm');
  const editItemIdInput = document.getElementById('editItemId');
  const editNameInput = document.getElementById('editName');
  const editColorInput = document.getElementById('editColor');
  const editPriceInput = document.getElementById('editPrice');
  const editQuantityInput = document.getElementById('editQuantity');
  const editThresholdInput = document.getElementById('editThreshold');
  const editMsg = document.getElementById('editMsg');
  const editCancelBtn = document.getElementById('editCancelBtn');

  // Edit restock elements
  const editRequestOverlay = document.getElementById('editRequestOverlay');
  const editRequestForm = document.getElementById('editRequestForm');
  const editRequestIdInput = document.getElementById('editRequestId');
  const editRequestQtyInput = document.getElementById('editRequestQty');
  const editRequestMsg = document.getElementById('editRequestMsg');
  const editRequestCancelBtn = document.getElementById('editRequestCancelBtn');

  // Escape HTML
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Empty start data
  function seedData() {
    items = [];
    nextId = 1;
    restockRequests = [];
    nextRequestId = 1;
  }

  // Save and load
  const STORAGE_KEY = 'itemInventoryAppStateV3';

  function saveState() {
    try {
      const state = {
        items: items,
        restockRequests: restockRequests,
        nextId: nextId,
        nextRequestId: nextRequestId
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Could not save inventory data to localStorage:', err);
    }
  }

  // Load and clean
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        seedData();
        saveState();
        return;
      }

      const state = JSON.parse(raw);

      const cleanItems = [];
      let cleanItemCount = 0;
      let maxItemId = 0;

      if (state && Array.isArray(state.items)) {
        for (let i = 0; i < state.items.length; i++) {
          const src = state.items[i];

          if (!src || typeof src !== 'object') continue;

          const id = parseInt(src.id, 10);
          if (isNaN(id)) continue;

          cleanItems[cleanItemCount] = {
            id: id,
            name: String(src.name === undefined ? '' : src.name),
            color: String(src.color === undefined ? '' : src.color),
            price: Number(src.price) || 0,
            quantity: Number(src.quantity) || 0,
            restockThreshold: Number(src.restockThreshold) || 0,
            supplier: String(src.supplier === undefined || src.supplier === '' ? 'Unknown supplier' : src.supplier)
          };
          cleanItemCount++;

          if (id > maxItemId) maxItemId = id;
        }
      }

      const cleanRequests = [];
      let cleanRequestCount = 0;
      let maxRequestId = 0;

      if (state && Array.isArray(state.restockRequests)) {
        for (let i = 0; i < state.restockRequests.length; i++) {
          const req = state.restockRequests[i];

          if (!req || typeof req !== 'object') continue;

          const reqId = parseInt(req.requestId, 10);
          if (isNaN(reqId)) continue;

          cleanRequests[cleanRequestCount] = req;
          cleanRequestCount++;

          if (reqId > maxRequestId) maxRequestId = reqId;
        }
      }

      items = cleanItems;
      restockRequests = cleanRequests;

      nextId = maxItemId + 1;
      if (state && typeof state.nextId === 'number' && state.nextId > nextId) {
        nextId = state.nextId;
      }

      nextRequestId = maxRequestId + 1;
      if (state && typeof state.nextRequestId === 'number' && state.nextRequestId > nextRequestId) {
        nextRequestId = state.nextRequestId;
      }
    } catch (err) {
      console.warn('Could not load saved inventory data, starting empty:', err);
      seedData();
    }
  }

  // Stock status
  function getStatus(item) {
    if (item.quantity <= 0) {
      return { label: 'Out of Stock', cssClass: 'out' };
    } else if (item.quantity <= item.restockThreshold) {
      return { label: 'Low Stock', cssClass: 'low' };
    } else {
      return { label: 'Available', cssClass: 'available' };
    }
  }

  // Auto restock
  function checkAutoRestock() {
    const createdNames = [];
    let createdCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.quantity <= item.restockThreshold) {
        // Pending check
        let hasPending = false;

        for (let j = 0; j < restockRequests.length; j++) {
          if (restockRequests[j].itemId === item.id &&
              restockRequests[j].status === 'Pending') {
            hasPending = true;
            break;
          }
        }

        if (!hasPending) {
          // Default quantity
          const defaultQty = Math.max(1, (item.restockThreshold * 2) - item.quantity);

          restockRequests[restockRequests.length] = {
            requestId: nextRequestId++,
            itemId: item.id,
            itemName: item.name,
            supplier: item.supplier,
            quantityToAdd: defaultQty,
            status: 'Pending',
            dateRequested: new Date().toLocaleString()
          };

          createdNames[createdCount] = item.name;
          createdCount++;
        }
      }
    }

    return createdNames;
  }

  // Draw tables
  function render() {
    const createdNames = checkAutoRestock();

    if (createdNames.length > 0) {
      restockNotice.textContent =
        'Low stock detected. Restock order automatically sent to the supplier for: ' +
        createdNames.join(', ') + '.';
    } else {
      restockNotice.textContent = '';
    }
    restockNotice.className = 'msg ok';

    if (items.length === 0) {
      inventoryBody.innerHTML =
        '<tr class="empty-row"><td colspan="7">No items in inventory.</td></tr>';
    } else {
      inventoryBody.innerHTML = items.map(function (item) {
        const status = getStatus(item);

        return '<tr>' +
          '<td>' + item.id + '</td>' +
          '<td>' + escapeHtml(item.name) + '</td>' +
          '<td>' + escapeHtml(item.color) + '</td>' +
          '<td>₱' + Number(item.price).toFixed(2) + '</td>' +
          '<td>' + item.quantity + '</td>' +
          '<td><span class="badge ' + status.cssClass + '">' + status.label + '</span></td>' +
          '<td><div class="actions-cell">' +
            '<button type="button" class="action-btn" data-edit-id="' + item.id + '">Edit Stock</button>' +
            '<button type="button" class="action-btn btn-danger" data-remove-id="' + item.id + '">Remove Item</button>' +
          '</div></td>' +
          '</tr>';
      }).join('');
    }

    if (restockRequests.length === 0) {
      restockBody.innerHTML =
        '<tr class="empty-row"><td colspan="6">No restock requests yet.</td></tr>';
    } else {
      restockBody.innerHTML = restockRequests.map(function (req) {
        let actionCell;

        if (req.status === 'Completed') {
          actionCell = 'Completed';
        } else {
          let itemStillExists = false;

          for (let i = 0; i < items.length; i++) {
            if (items[i].id === req.itemId) {
              itemStillExists = true;
              break;
            }
          }

          actionCell = itemStillExists
            ? '<div class="actions-cell">' +
                '<button type="button" class="action-btn" data-edit-request-id="' +
                  req.requestId + '">Edit Quantity</button>' +
                '<button type="button" class="action-btn" data-request-id="' +
                  req.requestId + '">Mark Completed</button>' +
              '</div>'
            : 'Item unavailable';
        }

        return '<tr>' +
          '<td>' + escapeHtml(req.dateRequested) + '</td>' +
          '<td>' + escapeHtml(req.itemName) + '</td>' +
          '<td>' + escapeHtml(req.supplier) + '</td>' +
          '<td>' + req.quantityToAdd + '</td>' +
          '<td>' + escapeHtml(req.status) + '</td>' +
          '<td>' + actionCell + '</td>' +
          '</tr>';
      }).join('');
    }

    saveState();
  }

  // Add item (from Product Management)
  function addInventoryItem(data) {
    if (!data || typeof data !== 'object') return null;

    const name = String(data.name === undefined ? '' : data.name).trim();
    const color = String(data.color === undefined ? '' : data.color).trim();
    const price = Number(data.price);
    const quantity = Number(data.quantity);
    const threshold = Number(data.restockThreshold);
    const supplier = String(data.supplier === undefined ? '' : data.supplier).trim();

    if (name === '' || color === '') return null;
    if (!isFinite(price) || price < 0) return null;
    if (!Number.isInteger(quantity) || quantity < 0) return null;
    if (!Number.isInteger(threshold) || threshold < 0) return null;

    const newItem = {
      id: nextId++,
      name: name,
      color: color,
      price: price,
      quantity: quantity,
      restockThreshold: threshold,
      supplier: supplier === '' ? 'Unknown supplier' : supplier
    };

    items[items.length] = newItem;
    render();
    return newItem;
  }

  // Reduce stock (from POS)
  function reduceStock(itemId, amount) {
    const targetId = parseInt(itemId, 10);
    const qty = Number(amount);

    if (isNaN(targetId)) return false;
    if (!Number.isInteger(qty) || qty < 1) return false;

    for (let i = 0; i < items.length; i++) {
      if (items[i].id === targetId) {
        if (items[i].quantity < qty) return false;

        items[i].quantity -= qty;
        render();
        return true;
      }
    }

    return false;
  }

  // Mark completed
  restockBody.addEventListener('click', function (e) {
    const button = e.target.closest('button[data-request-id]');

    if (!button) return;

    const targetRequestId =
      parseInt(button.getAttribute('data-request-id'), 10);

    let request = null;

    for (let i = 0; i < restockRequests.length; i++) {
      if (restockRequests[i].requestId === targetRequestId) {
        request = restockRequests[i];
        break;
      }
    }

    if (!request) return;

    // Pending only
    if (request.status !== 'Pending') return;

    let itemFound = false;

    for (let i = 0; i < items.length; i++) {
      if (items[i].id === request.itemId) {
        itemFound = true;
        items[i].quantity += request.quantityToAdd;
        break;
      }
    }

    if (itemFound) {
      request.status = 'Completed';
    }

    render();
  });

  // Edit restock quantity
  restockBody.addEventListener('click', function (e) {
    const button = e.target.closest('button[data-edit-request-id]');

    if (!button) return;

    const targetRequestId =
      parseInt(button.getAttribute('data-edit-request-id'), 10);

    let request = null;

    for (let i = 0; i < restockRequests.length; i++) {
      if (restockRequests[i].requestId === targetRequestId) {
        request = restockRequests[i];
        break;
      }
    }

    if (!request) return;

    if (request.status !== 'Pending') return;

    editRequestIdInput.value = request.requestId;
    editRequestQtyInput.value = request.quantityToAdd;

    editRequestMsg.textContent = '';
    editRequestMsg.className = 'msg';

    editRequestOverlay.classList.add('open');
  });

  function closeEditRequestModal() {
    editRequestOverlay.classList.remove('open');
    editRequestForm.reset();
    editRequestMsg.textContent = '';
    editRequestMsg.className = 'msg';
  }

  editRequestCancelBtn.addEventListener('click', function () {
    closeEditRequestModal();
  });

  editRequestOverlay.addEventListener('click', function (e) {
    if (e.target === editRequestOverlay) {
      closeEditRequestModal();
    }
  });

  editRequestForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const targetRequestId = parseInt(editRequestIdInput.value, 10);
    const rawQty = editRequestQtyInput.value.trim();
    const newQty = Number(rawQty);

    if (rawQty === '' || !Number.isInteger(newQty) || newQty < 1) {
      editRequestMsg.textContent = 'Please enter a whole number of 1 or more.';
      editRequestMsg.className = 'msg error';
      return;
    }

    let request = null;

    for (let i = 0; i < restockRequests.length; i++) {
      if (restockRequests[i].requestId === targetRequestId) {
        request = restockRequests[i];
        break;
      }
    }

    if (!request) {
      editRequestMsg.textContent = 'Restock request not found.';
      editRequestMsg.className = 'msg error';
      return;
    }

    if (request.status !== 'Pending') {
      editRequestMsg.textContent = 'Only Pending requests can be edited.';
      editRequestMsg.className = 'msg error';
      return;
    }

    let itemStillExists = false;

    for (let i = 0; i < items.length; i++) {
      if (items[i].id === request.itemId) {
        itemStillExists = true;
        break;
      }
    }

    if (!itemStillExists) {
      editRequestMsg.textContent = 'This item no longer exists.';
      editRequestMsg.className = 'msg error';
      return;
    }

    request.quantityToAdd = newQty;

    render();
    closeEditRequestModal();

    restockNotice.textContent = 'Restock quantity updated.';
    restockNotice.className = 'msg ok';
  });

  // Edit stock
  inventoryBody.addEventListener('click', function (e) {
    const button = e.target.closest('button[data-edit-id]');

    if (!button) return;

    const targetId = parseInt(button.getAttribute('data-edit-id'), 10);

    let item = null;

    for (let i = 0; i < items.length; i++) {
      if (items[i].id === targetId) {
        item = items[i];
        break;
      }
    }

    if (!item) return;

    editItemIdInput.value = item.id;
    editNameInput.value = item.name;
    editColorInput.value = item.color;
    editPriceInput.value = item.price;
    editQuantityInput.value = item.quantity;
    editThresholdInput.value = item.restockThreshold;

    editMsg.textContent = '';
    editMsg.className = 'msg';

    editOverlay.classList.add('open');
  });

  function closeEditModal() {
    editOverlay.classList.remove('open');
    editForm.reset();
    editMsg.textContent = '';
    editMsg.className = 'msg';
  }

  editCancelBtn.addEventListener('click', function () {
    closeEditModal();
  });

  editOverlay.addEventListener('click', function (e) {
    if (e.target === editOverlay) {
      closeEditModal();
    }
  });

  editForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const targetId = parseInt(editItemIdInput.value, 10);
    const newName = editNameInput.value.trim();
    const newColor = editColorInput.value.trim();
    const newPrice = parseFloat(editPriceInput.value);
    const newQuantity = parseInt(editQuantityInput.value, 10);
    const newThreshold = parseInt(editThresholdInput.value, 10);

    if (newName === '' || newColor === '') {
      editMsg.textContent = 'Name and color cannot be empty.';
      editMsg.className = 'msg error';
      return;
    }

    if (isNaN(newPrice) || newPrice < 0) {
      editMsg.textContent = 'Please enter a valid price.';
      editMsg.className = 'msg error';
      return;
    }

    if (isNaN(newQuantity) || newQuantity < 0) {
      editMsg.textContent = 'Please enter a valid quantity.';
      editMsg.className = 'msg error';
      return;
    }

    if (isNaN(newThreshold) || newThreshold < 0) {
      editMsg.textContent = 'Please enter a valid restock threshold.';
      editMsg.className = 'msg error';
      return;
    }

    let itemFound = false;

    for (let i = 0; i < items.length; i++) {
      if (items[i].id === targetId) {
        items[i].name = newName;
        items[i].color = newColor;
        items[i].price = newPrice;
        items[i].quantity = newQuantity;
        items[i].restockThreshold = newThreshold;
        itemFound = true;
        break;
      }
    }

    if (!itemFound) {
      editMsg.textContent = 'Item not found.';
      editMsg.className = 'msg error';
      return;
    }

    // Sync pending names
    for (let i = 0; i < restockRequests.length; i++) {
      if (restockRequests[i].itemId === targetId &&
          restockRequests[i].status === 'Pending') {
        restockRequests[i].itemName = newName;
      }
    }

    render();
    closeEditModal();

    inventoryMsg.textContent = 'Item updated successfully.';
    inventoryMsg.className = 'msg ok';
  });

  // Remove item
  inventoryBody.addEventListener('click', function (e) {
    const button = e.target.closest('button[data-remove-id]');

    if (!button) return;

    const targetId = parseInt(button.getAttribute('data-remove-id'), 10);

    let targetIndex = -1;
    let targetName = '';

    for (let i = 0; i < items.length; i++) {
      if (items[i].id === targetId) {
        targetIndex = i;
        targetName = items[i].name;
        break;
      }
    }

    if (targetIndex === -1) return;

    const confirmed = window.confirm(
      'Remove "' + targetName + '" from inventory? This cannot be undone.'
    );

    if (!confirmed) return;

    // Copy without item
    const remainingItems = [];
    let remainingCount = 0;

    for (let i = 0; i < items.length; i++) {
      if (i !== targetIndex) {
        remainingItems[remainingCount] = items[i];
        remainingCount++;
      }
    }

    items = remainingItems;

    render();

    inventoryMsg.textContent = '"' + targetName + '" was removed from inventory.';
    inventoryMsg.className = 'msg ok';
  });

  // Live tab sync
  window.addEventListener('storage', function (e) {
    if (e.key !== STORAGE_KEY || e.newValue === null) return;

    loadState();
    render();
  });

  // Start app
  loadState();
  render();
