document.addEventListener('DOMContentLoaded', () => {
    // ----- DOM 요소 (변경 없음) -----
    const views = { setup: document.getElementById('setup-view'), main: document.getElementById('main-view'), detail: document.getElementById('detail-view') };
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const searchBtn = document.getElementById('search-btn');
    const voiceSearchBtn = document.getElementById('voice-search-btn');
    const wordListContainer = document.getElementById('word-list-container');
    const backButton = document.getElementById('back-button');
    const flashcard = document.querySelector('.flashcard');
    const flashcardFront = document.getElementById('flashcard-front');
    const flashcardBack = document.getElementById('flashcard-back');
    const flashcardEng = document.getElementById('flashcard-eng');
    const flashcardKor = document.getElementById('flashcard-kor');
    const speakButton = document.getElementById('speak-button');
    const favoriteButton = document.getElementById('favorite-button');
    const settingsBtn = document.getElementById('settings-btn');
    const favoritesListBtn = document.getElementById('favorites-list-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const resetDataBtn = document.getElementById('reset-data-btn');
    const fileInput = document.getElementById('file-input');
    const setupStatus = document.getElementById('setup-status');
    const increaseFontBtn = document.getElementById('increase-font-btn');
    const decreaseFontBtn = document.getElementById('decrease-font-btn');
    const fontSizeDisplay = document.getElementById('font-size-display');
    const toast = document.getElementById('toast');
    
    // ----- 상태 변수 -----
    let db;
    let currentWord = null;
    let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
    let currentFontSize = parseInt(localStorage.getItem('fontSize')) || 16;
    let isFavoritesView = false;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    // ----- 상수 -----
    const DB_NAME = "MyDictionaryDB", STORE_NAME = "words", DB_VERSION = 1;

    // ----- 뷰 관리 (변경 없음) -----
    function showView(viewName) { Object.values(views).forEach(v => v.classList.add('hidden')); views[viewName].classList.remove('hidden'); }

    // ----- IndexedDB (변경 없음) -----
    function openDB() { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, DB_VERSION); request.onerror = e => reject("DB 열기 오류: " + e.target.errorCode); request.onsuccess = e => { db = e.target.result; resolve(db); }; request.onupgradeneeded = e => { const store = e.target.result.createObjectStore(STORE_NAME, { keyPath: "id" }); store.createIndex("english_idx", "english", { unique: false }); }; }); }
    function checkDBStatus() { return new Promise((resolve) => { if (!db) { resolve(false); return; } const tx = db.transaction(STORE_NAME, "readonly"); const store = tx.objectStore(STORE_NAME); const countReq = store.count(); countReq.onsuccess = () => resolve(countReq.result > 0); countReq.onerror = () => resolve(false); }); }
    function importDataToDB(wordsData) { return new Promise((resolve, reject) => { const tx = db.transaction(STORE_NAME, "readwrite"); const store = tx.objectStore(STORE_NAME); let count = 0; const total = wordsData.length; wordsData.forEach(word => { const req = store.add(word); req.onsuccess = () => { count++; if (count % 1000 === 0 || count === total) setupStatus.textContent = `단어 저장 중... (${count} / ${total})`; }; }); tx.oncomplete = () => resolve(); tx.onerror = e => reject("데이터 저장 오류: " + e.target.error); }); }
    function clearDB() { return new Promise((resolve, reject) => { const tx = db.transaction(STORE_NAME, "readwrite"); const store = tx.objectStore(STORE_NAME); const req = store.clear(); req.onsuccess = () => resolve(); req.onerror = e => reject("DB 초기화 오류: " + e.target.error); }); }

    // ----- 데이터 조회 (변경 없음) -----
    function searchWords(term) { return new Promise((resolve) => { const searchTerm = term.trim().toLowerCase(); if (!db || searchTerm.length === 0) { resolve([]); return; } const tx = db.transaction(STORE_NAME, "readonly"); const store = tx.objectStore(STORE_NAME); const results = new Map(); const req = store.openCursor(); let count = 0; req.onerror = e => { console.error("커서 오류:", e.target.error); resolve([]); }; req.onsuccess = e => { const cursor = e.target.result; if (cursor && count < 100) { const word = cursor.value; if (word.english.toLowerCase().includes(searchTerm) || word.korean.includes(searchTerm)) { results.set(word.id, word); count++; } cursor.continue(); } else { resolve(Array.from(results.values())); } }; }); }
    function getWordsByIds(ids) { return new Promise((resolve) => { if (!db || ids.length === 0) { resolve([]); return; } const tx = db.transaction(STORE_NAME, "readonly"); const store = tx.objectStore(STORE_NAME); const results = []; let processed = 0; ids.forEach(id => { const req = store.get(id); req.onsuccess = () => { if (req.result) results.push(req.result); processed++; if (processed === ids.length) resolve(results); }; }); }); }

    // ----- UI 렌더링 -----
    function displayWords(words) { wordListContainer.innerHTML = ''; if (words.length === 0) { wordListContainer.innerHTML = `<p class="placeholder">${isFavoritesView ? '즐겨찾기한 단어가 없습니다.' : '검색 결과가 없습니다.'}</p>`; return; } words.forEach(word => { const item = document.createElement('div'); item.className = 'word-item'; const summary = word.korean.length > 40 ? word.korean.substring(0, 40) + '...' : word.korean; item.innerHTML = `<span class="word-item-eng">${word.english}</span><span class="word-item-kor">${summary}</span>`; item.addEventListener('click', () => showDetailView(word)); wordListContainer.appendChild(item); }); }
    
    function showDetailView(word) {
        currentWord = word;
        flashcardEng.textContent = word.english;
        flashcardKor.textContent = word.korean;
        flashcard.classList.remove('flipped');
        updateFavoriteButton();
        showView('detail');
        // 복잡한 로직 제거, 스크롤 위치만 초기화
        flashcardFront.scrollTop = 0;
        flashcardBack.scrollTop = 0;
    }
    
    function updateFavoriteButton() { if (favorites.includes(currentWord.id)) { favoriteButton.classList.add('favorited'); favoriteButton.innerHTML = '<i class="fas fa-star"></i>'; } else { favoriteButton.classList.remove('favorited'); favoriteButton.innerHTML = '<i class="far fa-star"></i>'; } }
    function showToast(message) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => { toast.classList.remove('show'); }, 2000); }
    
    function applyFontSize() {
        document.documentElement.style.fontSize = `${currentFontSize}px`;
        fontSizeDisplay.textContent = `${currentFontSize}px`;
        localStorage.setItem('fontSize', currentFontSize);
    }

    // ----- 이벤트 처리 -----
    async function performSearch() { if(isFavoritesView) { isFavoritesView = false; favoritesListBtn.classList.remove('active'); } const term = searchInput.value; const words = await searchWords(term); displayWords(words); }
    searchInput.addEventListener('input', () => clearSearchBtn.classList.toggle('hidden', searchInput.value.length === 0));
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
    clearSearchBtn.addEventListener('click', () => { searchInput.value = ''; clearSearchBtn.classList.add('hidden'); if(!isFavoritesView) wordListContainer.innerHTML = `<p class="placeholder">검색어를 입력하여 단어를 찾아보세요.</p>`; });
    searchBtn.addEventListener('click', performSearch);
    if (SpeechRecognition) { voiceSearchBtn.addEventListener('click', () => { const recognition = new SpeechRecognition(); recognition.lang = 'ko-KR'; recognition.onresult = (event) => {
    let transcript = event.results[0][0].transcript; // "비행기."

    // 마지막 글자가 마침표이면 제거합니다.
    if (transcript.endsWith('.')) {
        transcript = transcript.slice(0, -1); // "비행기"
    }

    searchInput.value = transcript;
    performSearch();
}; recognition.start(); }); } else { voiceSearchBtn.style.display = 'none'; }
    backButton.addEventListener('click', async () => { showView('main'); if (isFavoritesView) { const favoriteWords = await getWordsByIds(favorites); displayWords(favoriteWords); } });
    flashcard.addEventListener('click', () => flashcard.classList.toggle('flipped'));
    speakButton.addEventListener('click', () => { if (currentWord && 'speechSynthesis' in window) { const utterance = new SpeechSynthesisUtterance(currentWord.english); utterance.lang = 'en-US'; window.speechSynthesis.speak(utterance); } });
    favoriteButton.addEventListener('click', () => { const wordId = currentWord.id; const index = favorites.indexOf(wordId); if (index > -1) { favorites.splice(index, 1); showToast('즐겨찾기에서 삭제되었습니다.'); } else { favorites.push(wordId); showToast('즐겨찾기에 추가되었습니다.'); } localStorage.setItem('favorites', JSON.stringify(favorites)); updateFavoriteButton(); });
    favoritesListBtn.addEventListener('click', async () => { isFavoritesView = !isFavoritesView; favoritesListBtn.classList.toggle('active', isFavoritesView); searchInput.value = ''; clearSearchBtn.classList.add('hidden'); if (isFavoritesView) { const favoriteWords = await getWordsByIds(favorites); displayWords(favoriteWords); } else { wordListContainer.innerHTML = `<p class="placeholder">검색어를 입력하여 단어를 찾아보세요.</p>`; } });
    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeModalBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) settingsModal.classList.add('hidden'); });
    resetDataBtn.addEventListener('click', async () => { if (confirm('정말로 모든 단어 데이터를 삭제하시겠습니까?')) { try { await clearDB(); localStorage.clear(); showToast('모든 데이터가 초기화되었습니다.'); location.reload(); } catch (error) { alert(error); } } });
    
    // ★★★★★ 폰트 크기 조절 버튼 수정 (최대 45px) ★★★★★
    increaseFontBtn.addEventListener('click', () => {
        currentFontSize = Math.min(45, currentFontSize + 1);
        applyFontSize();
    });
    decreaseFontBtn.addEventListener('click', () => {
        currentFontSize = Math.max(12, currentFontSize - 1);
        applyFontSize();
    });

    // 파일 가져오기 (변경 없음)
    fileInput.addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = async (e) => { try { const wordsData = JSON.parse(e.target.result); await importDataToDB(wordsData); setupStatus.textContent = '✅ 설정 완료!'; setTimeout(() => { location.reload(); }, 1500); } catch (err) { setupStatus.textContent = '오류: 올바른 JSON 파일이 아닙니다.'; alert("파일 처리 오류: " + err); } }; reader.readAsText(file); });

    // ----- 앱 초기화 -----
    async function init() {
        applyFontSize();
        try {
            await openDB();
            const isDataReady = await checkDBStatus();
            if (isDataReady) {
                showView('main');
            } else {
                showView('setup');
            }
        } catch (error) {
            alert("앱 초기화 오류: " + error);
            document.body.innerHTML = "<h1>앱 로딩 실패</h1>";
        }
    }

    init();
});