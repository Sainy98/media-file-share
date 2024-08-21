const form = document.getElementById('uploadForm');
const fileInput = document.getElementById('mediaInput');
const fileList = document.getElementById('fileList');
const rangeInput = document.getElementById('rangeInput');
const rangeValue = document.getElementById('rangeValue');
const spaceInfo = document.getElementById('spaceInfo');

const backendLink = 'http://localhost:3000';
const MAX_SPACE_MB = 100; // Max space in MB

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
    rangeValue.textContent = 'Valid for ' + rangeInput.value + ' hours';
}

fileList.style.display = "none";

function selectedFile() {
    fileList.style.display = "block";
    const files = fileInput.files;
    fileList.innerHTML = '';  // Clear the list before adding new files
    if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            let listItem = document.createElement('li');
            listItem.textContent = files[i].name;
            fileList.appendChild(listItem);
        }
    } else {
        console.log('No files selected');
    }
}

document.getElementById("submitBtn").addEventListener('click', function(event) {
    event.preventDefault();
    const files = fileInput.files;
    let newFilesTotalSize = 0;

    for (let i = 0; i < files.length; i++) {
        newFilesTotalSize += files[i].size;
    }

    if (newFilesTotalSize + getTotalSize() > MAX_SPACE_MB * 1024 * 1024) {
        alert('It looks like you’re trying to upload more files than your available space! 📂🚫 Please delete some files to free up space. 🗑️✨');
        return;
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('mediaFiles', files[i]);
    }
    formData.append('expiryTime', rangeInput.value);

    fetch(`${backendLink}/upload`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.fileLinks && data.fileLinks.length > 0) {
            const expiryTime = parseInt(data.expiryTime, 10);
            const expiryDate = new Date(Date.now() + expiryTime * 60 * 60 * 1000).toLocaleString();

            let existingFileDetails = JSON.parse(localStorage.getItem('uploadedFileDetails')) || [];

            const newFileDetails = data.fileLinks.map((fileLink, index) => {
                return {
                    fileLink,
                    fileName: files[index].name,
                    expiryDate,
                    size: files[index].size
                };
            });

            const allFileDetails = [...newFileDetails, ...existingFileDetails ];

            localStorage.setItem('uploadedFileDetails', JSON.stringify(allFileDetails));

            displayAllFileDetails(allFileDetails);
            updateSpaceInfo();

            setTimeout(() => {
                localStorage.removeItem('uploadedFileDetails');
                document.getElementById('linkContainer').innerHTML = '';
                updateSpaceInfo();
            }, expiryTime * 60 * 60 * 1000);
        } else {
            console.log('No shareable link received');
        }
    })
    .catch(error => console.error('Error uploading files:', error));
});

function displayAllFileDetails(detailsArray) {
    let linkContainer = document.getElementById('linkContainer');
    if (!linkContainer) {
        linkContainer = document.createElement('div');
        linkContainer.id = 'linkContainer';
        document.body.appendChild(linkContainer);
    }
    linkContainer.innerHTML = '';

    detailsArray.forEach((details, index) => {
        const linkItem = document.createElement('div');
        linkItem.innerHTML = `
            <p>📁: ${details.fileName}</p>
            <p>🔗: <a href="${details.fileLink}" target="_blank">${details.fileLink}</a></p>
            <p>💾: ${(details.size / (1024*1024)).toFixed(2)} MB</p>
            <p>🚮: ${details.expiryDate}</p>
            <button onclick="deleteFile(${index})">Delete</button>
            <button onclick="shareFile('${details.fileLink}')">Share</button>
            <hr>
        `;
        linkContainer.appendChild(linkItem);
    });
}

function deleteFile(index) {
    const savedDetails = JSON.parse(localStorage.getItem('uploadedFileDetails'));
    const fileDetails = savedDetails[index];
    const fileUrl = fileDetails.fileLink;
    const filename = fileUrl.split('/').pop();

    fetch(`${backendLink}/files/${filename}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (response.ok) {
            savedDetails.splice(index, 1);
            localStorage.setItem('uploadedFileDetails', JSON.stringify(savedDetails));
            displayAllFileDetails(savedDetails);
            updateSpaceInfo();
        } else {
            console.error('Error deleting file:', response.statusText);
        }
    })
    .catch(error => console.error('Error deleting file:', error));
}

function shareFile(fileLink) {
    navigator.clipboard.writeText(fileLink).then(() => {
        alert('Link copied to clipboard');
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}

// Load the file details from localStorage when the page loads
window.addEventListener('load', function() {
    const savedDetails = localStorage.getItem('uploadedFileDetails');
    if (savedDetails) {
        const detailsArray = JSON.parse(savedDetails);
        displayAllFileDetails(detailsArray);
        updateSpaceInfo();
    }
});
