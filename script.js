const form = document.getElementById('uploadForm');
const fileInput = document.getElementById('mediaInput');
const fileList = document.getElementById('fileList');
const SelectedfileList = document.getElementById('selectedFiles');
const rangeInput = document.getElementById('rangeInput');
const rangeValue = document.getElementById('rangeValue');
const spaceInfo = document.getElementById('spaceInfo');
const uploadMsg = document.getElementById('uploadingStatus');

// const backendLink = 'http://localhost:3000';
const backendLink = 'https://mediashare-5t23.onrender.com';
const MAX_SPACE_MB = 200;

function updateSpaceInfo() {
    const totalSizeMB = getTotalSize() / (1024 * 1024);
    const availableSpaceMB = MAX_SPACE_MB - totalSizeMB;
    spaceInfo.textContent = `Available space: ${availableSpaceMB.toFixed(2)} MB`;
}

function getTotalSize() {
    const savedDetails = JSON.parse(localStorage.getItem('uploadedFileDetails')) || [];
    return savedDetails.reduce((total, file) => total + file.size, 0);
}

function expiryHour() {
    rangeValue.textContent = `Valid for ${rangeInput.value} hours`;
}

function selectedFile() {
    fileList.style.display = "block";
    const files = fileInput.files;
    fileList.innerHTML = '';
    for (let i = 0; i < files.length; i++) {
        let listItem = document.createElement('li');
        listItem.textContent = files[i].name;
        fileList.appendChild(listItem);
    }
}

document.getElementById("submitBtn").addEventListener('click', function (event) {
    event.preventDefault();
   
    const files = fileInput.files;

    if (files.length === 0) {
        alert('📂 Please select a file to upload.');
        return;
    }

    document.getElementById("submitBtn").innerHTML = "Processing...";
    uploadMsg.style.display = "block";

    let newFilesTotalSize = Array.from(files).reduce((total, file) => total + file.size, 0);
    if (newFilesTotalSize + getTotalSize() > MAX_SPACE_MB * 1024 * 1024) {
        alert('🚀 Exceeded available space! Please delete some files and try again.');
        uploadMsg.style.display = "none";
        return;
    }

    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('mediaFiles', file));
    formData.append('expiryTime', rangeInput.value);

    axios.post(`${backendLink}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        .then(response => {
            const expiryTime = parseInt(response.data.expiryTime, 10);
            const expiryDate = new Date(Date.now() + expiryTime * 60 * 60 * 1000).toLocaleString();
            const existingFileDetails = JSON.parse(localStorage.getItem('uploadedFileDetails')) || [];
            const newFileDetails = response.data.fileLinks.map((fileLink, index) => ({
                fileLink,
                fileName: files[index].name,
                expiryDate,
                size: files[index].size
            }));

            const allFileDetails = [...newFileDetails, ...existingFileDetails];
            localStorage.setItem('uploadedFileDetails', JSON.stringify(allFileDetails));
            displayAllFileDetails(allFileDetails);
            updateSpaceInfo();

           
            uploadMsg.style.display = "none";
        })
        .catch(error => {
            console.error('Error uploading files:', error);
            alert('⚠️ Error uploading files. Try again later.');
            uploadMsg.style.display = 'none';
        })
        .finally(() => {
        document.getElementById("submitBtn").innerHTML = "Submit"
          SelectedfileList.style.display="none"
          alert('Your file successfully added ✔');
});
          
});

function displayAllFileDetails(detailsArray) {
    const linkContainer = document.getElementById('linkContainer');
    linkContainer.innerHTML = '';


    detailsArray.forEach((details, index) => {
        const linkItem = document.createElement('div');
        linkItem.innerHTML = `
            <p>📁: ${details.fileName}</p>
            <p>🔗: <a href="${details.fileLink}" target="_blank">${details.fileLink}</a></p>
            <p>💾: ${(details.size / (1024 * 1024)).toFixed(2)} MB</p>
            <p>🚮: ${details.expiryDate}</p>
            <button onclick="deleteFile(${index}, this)">Delete</button>
            <button onclick="shareFile('${details.fileLink}')">Share</button>
            <hr>
        `;
        linkContainer.appendChild(linkItem);
    });
}


function shareFile(fileLink) {
    navigator.clipboard.writeText(fileLink).then(() => {
        alert('✅ Link copied to clipboard.');
    }).catch(err => console.error('Copy failed:', err));
}

function deleteFile(index, btnElement) {
    const savedDetails = JSON.parse(localStorage.getItem('uploadedFileDetails'));
    const fileDetails = savedDetails[index];
    const fileUrl = fileDetails.fileLink;
    const filename = fileUrl.split('/').pop();
    btnElement.innerHTML = 'Deleting...';

    axios.delete(`${backendLink}/files/${filename}`)
        .then(() => {
            savedDetails.splice(index, 1);  // Remove from local storage
            localStorage.setItem('uploadedFileDetails', JSON.stringify(savedDetails));
            displayAllFileDetails(savedDetails);
            updateSpaceInfo();
        })
        .catch(error => {
            console.error('Error deleting file:', error);
            alert('⚠️ Error deleting file. Try again later.');
        })
        .finally(() => btnElement.innerHTML = 'Delete');
}


window.addEventListener('load', async () => {
    const savedDetails = JSON.parse(localStorage.getItem('uploadedFileDetails')) || [];
    await syncWithServer(savedDetails);
    displayAllFileDetails(savedDetails);
    updateSpaceInfo();
});

async function syncWithServer(savedDetails) {
    for (let i = savedDetails.length - 1; i >= 0; i--) {
        const filename = savedDetails[i].fileLink.split('/').pop();

        try {
            await axios.head(`${backendLink}/files/${filename}`);
        } catch (error) {
            if (error.response && error.response.status === 404) {
                // File no longer exists on the server, remove from local storage
                savedDetails.splice(i, 1);
                localStorage.setItem('uploadedFileDetails', JSON.stringify(savedDetails));
            }
        }
    }
}