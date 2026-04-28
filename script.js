    // ---------- DATA MODEL ----------

    let salesDB = {};      // { "2025-01-15": [ {id, time, item, quantity, amount} ] }

    let expensesDB = {};

    let dynamicServices = [   // default services - editable

        { name: "Printing", price: 200 },

        { name: "Photocopy", price: 100 },

        { name: "Typesetting", price: 500 },

        { name: "Passport", price: 800 },

        { name: "ID Card", price: 2000 }

    ];



    let currentDate = new Date().toISOString().split('T')[0];

    let currentQty = 1;

    let weeklyChart, pieChart;



    // Helper: load from localStorage

    function loadAllData() {

        const savedSales = localStorage.getItem('cafeflow_sales');

        const savedExpenses = localStorage.getItem('cafeflow_expenses');

        const savedServices = localStorage.getItem('cafeflow_services');

        if(savedSales) salesDB = JSON.parse(savedSales);

        if(savedExpenses) expensesDB = JSON.parse(savedExpenses);

        if(savedServices) dynamicServices = JSON.parse(savedServices);

        if(!salesDB[currentDate]) salesDB[currentDate] = [];

        if(!expensesDB[currentDate]) expensesDB[currentDate] = [];

    }

    function persistAll() {

        localStorage.setItem('cafeflow_sales', JSON.stringify(salesDB));

        localStorage.setItem('cafeflow_expenses', JSON.stringify(expensesDB));

        localStorage.setItem('cafeflow_services', JSON.stringify(dynamicServices));

    }



    // Helpers: get totals for a given date

    function getTotals(date) {

        const sales = salesDB[date] || [];

        const expenses = expensesDB[date] || [];

        const income = sales.reduce((s, t) => s + t.amount, 0);

        const expenseSum = expenses.reduce((s, t) => s + t.amount, 0);

        return { income, expenseSum, profit: income - expenseSum, txCount: sales.length + expenses.length };

    }



    // Render KPI & tables & pie chart

    function renderCurrentDay() {

        const { income, expenseSum, profit, txCount } = getTotals(currentDate);

        document.getElementById('todayIncome').innerHTML = `₦${income.toLocaleString()}`;

        document.getElementById('todayExpense').innerHTML = `₦${expenseSum.toLocaleString()}`;

        const profitEl = document.getElementById('netProfitVal');

        profitEl.innerHTML = `₦${profit.toLocaleString()}`;

        profitEl.className = `kpi-value ${profit >=0 ? 'profit-positive' : 'profit-negative'}`;

        document.getElementById('txCount').innerHTML = txCount;



        // render sales table

        const salesList = salesDB[currentDate] || [];

        const salesTbody = document.getElementById('salesTbody');

        salesTbody.innerHTML = salesList.map(s => `

            <tr>

                <td>${s.time}</td><td>${s.item}</td><td>${s.quantity || 1}</td><td>₦${s.amount.toLocaleString()}</td>

                <td><button class="delete-trans" data-id="${s.id}" data-type="sale"><i class="fas fa-trash"></i></button></td>

            </tr>

        `).join('');

        // expenses table

        const expList = expensesDB[currentDate] || [];

        const expTbody = document.getElementById('expensesTbody');

        expTbody.innerHTML = expList.map(e => `

            <tr>

                <td>${e.time}</td><td>${e.type}</td><td>${e.notes || '-'}</td><td>₦${e.amount.toLocaleString()}</td>

                <td><button class="delete-trans" data-id="${e.id}" data-type="expense"><i class="fas fa-trash"></i></button></td>

            </tr>

        `).join('');

        attachDeleteEvents();

        updatePieChart();

    }



    function attachDeleteEvents() {

        document.querySelectorAll('.delete-trans').forEach(btn => {

            btn.removeEventListener('click', handleDelete);

            btn.addEventListener('click', handleDelete);

        });

    }

    function handleDelete(e) {

        const btn = e.currentTarget;

        const id = parseInt(btn.dataset.id);

        const type = btn.dataset.type;

        if(type === 'sale') {

            salesDB[currentDate] = (salesDB[currentDate] || []).filter(t => t.id !== id);

        } else {

            expensesDB[currentDate] = (expensesDB[currentDate] || []).filter(t => t.id !== id);

        }

        persistAll();

        renderCurrentDay();

        updateWeeklyChart();

        showToast('Deleted', '#ef4444');

    }



    function addSale(itemName, price, quantity = 1) {

        const total = price * quantity;

        const newSale = {

            id: Date.now(),

            time: new Date().toLocaleTimeString(),

            item: itemName,

            quantity: quantity,

            amount: total

        };

        if(!salesDB[currentDate]) salesDB[currentDate] = [];

        salesDB[currentDate].push(newSale);

        persistAll();

        renderCurrentDay();

        updateWeeklyChart();

        showToast(`✅ +${itemName} x${quantity} = ₦${total.toLocaleString()}`, '#10b981');

    }



    function addExpense(type, amount, notes) {

        const newExp = {

            id: Date.now(),

            time: new Date().toLocaleTimeString(),

            type: type,

            notes: notes,

            amount: amount

        };

        if(!expensesDB[currentDate]) expensesDB[currentDate] = [];

        expensesDB[currentDate].push(newExp);

        persistAll();

        renderCurrentDay();

        updateWeeklyChart();

        showToast(`➖ Expense: ${type} ₦${amount.toLocaleString()}`, '#f59e0b');

    }



    function undoLast() {

        const salesArr = salesDB[currentDate] || [];

        const expArr = expensesDB[currentDate] || [];

        const all = [...salesArr.map(s => ({...s, category:'sale'})), ...expArr.map(e => ({...e, category:'expense'}))];

        if(all.length === 0) { showToast('Nothing to undo', '#ef4444'); return; }

        all.sort((a,b) => b.id - a.id);

        const last = all[0];

        if(last.category === 'sale') {

            salesDB[currentDate] = salesArr.filter(s => s.id !== last.id);

        } else {

            expensesDB[currentDate] = expArr.filter(e => e.id !== last.id);

        }

        persistAll();

        renderCurrentDay();

        updateWeeklyChart();

        showToast('↩️ Undid last transaction', '#3b82f6');

    }



    // Weekly chart (last 7 real days, profit only)

    function getLast7DaysProfit() {

        let labels = [];

        let profits = [];

        for(let i = 6; i >= 0; i--) {

            let d = new Date();

            d.setDate(d.getDate() - i);

            let dateStr = d.toISOString().split('T')[0];

            labels.push(dateStr.slice(5));

            const { profit } = getTotals(dateStr);

            profits.push(profit);

        }

        return { labels, profits };

    }



    function updateWeeklyChart() {

        const { labels, profits } = getLast7DaysProfit();

        if(weeklyChart) weeklyChart.destroy();

        const ctx = document.getElementById('weeklyChart').getContext('2d');

        weeklyChart = new Chart(ctx, {

            type: 'line',

            data: { labels, datasets: [{ label: 'Net Profit (₦)', data: profits, borderColor: '#3b82f6', tension: 0.3, fill: true, backgroundColor: 'rgba(59,130,246,0.1)' }] },

            options: { responsive: true, maintainAspectRatio: true }

        });

    }



    function updatePieChart() {

        const salesToday = salesDB[currentDate] || [];

        const serviceMap = new Map();

        salesToday.forEach(s => { let key = s.item; serviceMap.set(key, (serviceMap.get(key) || 0) + s.amount); });

        const labels = Array.from(serviceMap.keys());

        const data = Array.from(serviceMap.values());

        if(pieChart) pieChart.destroy();

        const ctx = document.getElementById('pieChart').getContext('2d');

        pieChart = new Chart(ctx, { type: 'pie', data: { labels, datasets: [{ data, backgroundColor: ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4'] }] }, options: { responsive: true } });

    }



    function renderServiceButtons() {

        const container = document.getElementById('dynamicServiceButtons');

        container.innerHTML = '';

        dynamicServices.forEach(serv => {

            const btn = document.createElement('button');

            btn.className = 'service-btn';

            btn.innerHTML = `<i class="fas fa-tag"></i> ${serv.name} <strong>₦${serv.price.toLocaleString()}</strong>`;

            btn.onclick = () => addSale(serv.name, serv.price, currentQty);

            container.appendChild(btn);

        });

    }



    // Modal services editor

    function openServiceModal() {

        const editorDiv = document.getElementById('servicesEditorList');

        editorDiv.innerHTML = '';

        dynamicServices.forEach((serv, idx) => {

            const div = document.createElement('div');

            div.className = 'service-item';

            div.innerHTML = `

                <input type="text" value="${serv.name}" id="servName_${idx}" style="flex:2;">

                <input type="number" value="${serv.price}" id="servPrice_${idx}" style="flex:1;">

                <button class="icon-btn removeServiceBtn" data-idx="${idx}" style="background: none; color:red;"><i class="fas fa-times"></i></button>

            `;

            editorDiv.appendChild(div);

        });

        document.getElementById('serviceModal').style.display = 'flex';

        document.querySelectorAll('.removeServiceBtn').forEach(btn => {

            btn.onclick = (e) => {

                let idx = parseInt(btn.dataset.idx);

                dynamicServices.splice(idx,1);

                openServiceModal(); // refresh

            };

        });

    }



    function saveServicesFromModal() {

        let newServices = [];

        for(let i = 0; i < dynamicServices.length; i++) {

            let nameInput = document.getElementById(`servName_${i}`);

            let priceInput = document.getElementById(`servPrice_${i}`);

            if(nameInput && priceInput) {

                newServices.push({ name: nameInput.value, price: parseInt(priceInput.value) || 0 });

            }

        }

        dynamicServices = newServices;

        persistAll();

        renderServiceButtons();

        document.getElementById('serviceModal').style.display = 'none';

        showToast('Services updated', '#10b981');

    }



    function exportBackup() {

        const fullData = { salesDB, expensesDB, dynamicServices };

        const dataStr = JSON.stringify(fullData);

        const blob = new Blob([dataStr], {type: 'application/json'});

        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');

        a.href = url;

        a.download = `cafe_backup_${new Date().toISOString().slice(0,19)}.json`;

        a.click();

        URL.revokeObjectURL(url);

        showToast('Backup saved', '#3b82f6');

    }



    function restoreBackup(file) {

        const reader = new FileReader();

        reader.onload = e => {

            try {

                const data = JSON.parse(e.target.result);

                salesDB = data.salesDB || {};

                expensesDB = data.expensesDB || {};

                dynamicServices = data.dynamicServices || dynamicServices;

                if(!salesDB[currentDate]) salesDB[currentDate] = [];

                if(!expensesDB[currentDate]) expensesDB[currentDate] = [];

                persistAll();

                renderServiceButtons();

                renderCurrentDay();

                updateWeeklyChart();

                showToast('Restore successful!', '#10b981');

            } catch(err) { showToast('Invalid file', '#ef4444'); }

        };

        reader.readAsText(file);

    }



    function showToast(msg, bg='#3b82f6') {

        const toast = document.getElementById('toastMsg');

        toast.style.backgroundColor = bg;

        toast.textContent = msg;

        toast.style.display = 'block';

        setTimeout(() => toast.style.display = 'none', 2500);

    }



    function exportCSV() {

        const sales = salesDB[currentDate] || [];

        const expenses = expensesDB[currentDate] || [];

        let csv = `Cafe Report ${currentDate}\n\nSALES\nTime,Item,Quantity,Amount\n`;

        sales.forEach(s => csv += `${s.time},${s.item},${s.quantity || 1},${s.amount}\n`);

        csv += `\nEXPENSES\nTime,Type,Note,Amount\n`;

        expenses.forEach(e => csv += `${e.time},${e.type},${e.notes || '-'},${e.amount}\n`);

        const blob = new Blob([csv], {type: 'text/csv'});

        const a = document.createElement('a');

        a.href = URL.createObjectURL(blob);

        a.download = `cafe_${currentDate}.csv`;

        a.click();

        URL.revokeObjectURL(a.href);

        showToast('CSV exported');

    }



    function printReport() {

        const win = window.open('', '_blank');

        const { income, expenseSum, profit } = getTotals(currentDate);

        win.document.write(`<html><head><title>Report ${currentDate}</title><style>body{font-family:sans-serif;padding:2rem;}</style></head><body><h1>CafeFlow Report</h1><h3>${currentDate}</h3><p>Income: ₦${income}<br>Expense: ₦${expenseSum}<br>Profit: ₦${profit}</p><hr><h3>Sales</h3><table border=1>${(salesDB[currentDate]||[]).map(s=>`<tr><td>${s.time}</td><td>${s.item}</td><td>${s.quantity}</td><td>₦${s.amount}</td></tr>`).join('')}</table><h3>Expenses</h3><table border=1>${(expensesDB[currentDate]||[]).map(e=>`<tr><td>${e.time}</td><td>${e.type}</td><td>${e.notes}</td><td>₦${e.amount}</td></tr>`).join('')}</table></body></html>`);

        win.print();

    }



    function clearAll() {

        if(confirm('💀 PERMANENT DELETE: all sales and expenses for all dates. Continue?')) {

            salesDB = {}; expensesDB = {};

            salesDB[currentDate] = []; expensesDB[currentDate] = [];

            persistAll();

            renderCurrentDay();

            updateWeeklyChart();

            showToast('All data erased', '#ef4444');

        }

    }



    // Event listeners & dark mode

    function initTheme() {

        const isDark = localStorage.getItem('theme') === 'dark';

        if(isDark) document.body.classList.add('dark');

        document.getElementById('themeToggleBtn').onclick = () => {

            document.body.classList.toggle('dark');

            localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');

        };

    }



    document.addEventListener('DOMContentLoaded', () => {

        loadAllData();

        renderServiceButtons();

        renderCurrentDay();

        updateWeeklyChart();

        initTheme();

        document.getElementById('globalDatePicker').value = currentDate;

        document.getElementById('globalDatePicker').addEventListener('change', (e) => {

            currentDate = e.target.value;

            if(!salesDB[currentDate]) salesDB[currentDate] = [];

            if(!expensesDB[currentDate]) expensesDB[currentDate] = [];

            renderCurrentDay();

        });

        // quantity

        document.getElementById('qtyPlus').onclick = () => { currentQty = Math.min(20, currentQty+1); document.getElementById('currentQty').innerText = currentQty; };

        document.getElementById('qtyMinus').onclick = () => { currentQty = Math.max(1, currentQty-1); document.getElementById('currentQty').innerText = currentQty; };

        document.getElementById('addCustomSaleBtn').onclick = () => {

            let amt = parseInt(document.getElementById('customAmount').value);

            let desc = document.getElementById('customDesc').value.trim();

            if(isNaN(amt) || amt<=0 || !desc) { showToast('Enter valid amount & description', '#ef4444'); return; }

            addSale(desc, amt, 1);

            document.getElementById('customAmount').value = ''; document.getElementById('customDesc').value = '';

        };

        document.getElementById('addExpenseBtn').onclick = () => {

            let amount = parseInt(document.getElementById('expenseAmount').value);

            if(isNaN(amount) || amount<=0) { showToast('Valid amount needed', '#ef4444'); return; }

            let type = document.getElementById('expenseTypeSelect').value;

            let note = document.getElementById('expenseNote').value;

            addExpense(type, amount, note);

            document.getElementById('expenseAmount').value = ''; document.getElementById('expenseNote').value = '';

        };

        document.getElementById('undoBtn').onclick = undoLast;

        document.getElementById('settingsBtn').onclick = openServiceModal;

        document.getElementById('saveServicesBtn').onclick = saveServicesFromModal;

        document.getElementById('closeModalBtn').onclick = () => document.getElementById('serviceModal').style.display = 'none';

        document.getElementById('addServiceModalBtn').onclick = () => { dynamicServices.push({ name: "New Service", price: 100 }); openServiceModal(); };

        document.getElementById('exportCsvBtn').onclick = exportCSV;

        document.getElementById('printReportBtn').onclick = printReport;

        document.getElementById('backupJsonBtn').onclick = exportBackup;

        document.getElementById('restoreBtn').onclick = () => document.getElementById('restoreFileInput').click();

        document.getElementById('restoreFileInput').onchange = (e) => { if(e.target.files[0]) restoreBackup(e.target.files[0]); e.target.value = ''; };

        document.getElementById('clearAllBtn').onclick = clearAll;

        // Tabs

        document.querySelectorAll('.tab-btn').forEach(btn => {

            btn.onclick = () => {

                document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));

                btn.classList.add('active');

                const pane = btn.dataset.tab === 'sales' ? 'salesPane' : 'expensesPane';

                document.getElementById('salesPane').classList.remove('active');

                document.getElementById('expensesPane').classList.remove('active');

                document.getElementById(pane).classList.add('active');

            };

        });

    });

                                                   
