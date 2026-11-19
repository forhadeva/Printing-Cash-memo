// Islamic Art Prints - Central Database & Cloud Sync Manager
(function(window) {
  'use strict';

  const STORAGE_KEY = 'memo_invoices_database';
  const CLOUD_CONFIG_KEY = 'memo_cloud_db_url';

  const DB = {
    // Get all invoices from local database
    getAllInvoices: function() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) return [];
        return list;
      } catch(e) {
        console.error('Error reading invoices from localStorage:', e);
        return [];
      }
    },

    // Save invoices list to local database
    saveAllInvoices: function(list) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        // If cloud URL is configured, sync in background
        this.syncToCloud(list);
        return true;
      } catch(e) {
        console.error('Error saving invoices to localStorage:', e);
        return false;
      }
    },

    // Save or update a single invoice record
    saveInvoice: function(record) {
      if (!record || !record.number) return false;
      const list = this.getAllInvoices();
      const existingIdx = list.findIndex(item => item.number.trim().toLowerCase() === record.number.trim().toLowerCase());
      
      record.updatedAt = new Date().toISOString();
      if (!record.createdAt) {
        record.createdAt = record.updatedAt;
      }
      if (!record.id) {
        record.id = 'inv_' + Date.now();
      }

      if (existingIdx >= 0) {
        // Preserve deliveryStatus if already modified
        if (!record.deliveryStatus && list[existingIdx].deliveryStatus) {
          record.deliveryStatus = list[existingIdx].deliveryStatus;
        }
        list[existingIdx] = record;
      } else {
        list.unshift(record);
      }

      this.saveAllInvoices(list);
      return record;
    },

    // Get a specific invoice by number
    getInvoice: function(invNumber) {
      if (!invNumber) return null;
      const cleanNum = invNumber.trim().toLowerCase();
      const list = this.getAllInvoices();
      return list.find(item => item.number && item.number.trim().toLowerCase() === cleanNum) || null;
    },

    // Delete an invoice by number or ID
    deleteInvoice: function(idOrNum) {
      const list = this.getAllInvoices();
      const filtered = list.filter(item => item.id !== idOrNum && item.number !== idOrNum);
      this.saveAllInvoices(filtered);
      return filtered;
    },

    // Calculate next available invoice number (e.g. #0001, #0002...)
    getNextInvoiceNumber: function() {
      const list = this.getAllInvoices();
      let maxNum = 0;
      list.forEach(item => {
        if (item.number) {
          const match = item.number.match(/\d+/);
          if (match) {
            const val = parseInt(match[0], 10);
            if (!isNaN(val) && val > maxNum) {
              maxNum = val;
            }
          }
        }
      });
      const nextVal = maxNum + 1;
      return '#' + String(nextVal).padStart(4, '0');
    },

    // Toggle Delivery Status ('delivered' <-> 'pending')
    toggleDeliveryStatus: function(invNumber) {
      const list = this.getAllInvoices();
      const inv = list.find(item => item.number && item.number.trim().toLowerCase() === invNumber.trim().toLowerCase());
      if (inv) {
        inv.deliveryStatus = (inv.deliveryStatus === 'delivered') ? 'pending' : 'delivered';
        inv.updatedAt = new Date().toISOString();
        this.saveAllInvoices(list);
        return inv.deliveryStatus;
      }
      return null;
    },

    // Export database backup to downloadable JSON
    exportBackupJSON: function() {
      const list = this.getAllInvoices();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(list, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Islamic_Art_Prints_Invoices_Backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    },

    // Import database backup from JSON file content
    importBackupJSON: function(jsonString) {
      try {
        const imported = JSON.parse(jsonString);
        if (!Array.isArray(imported)) {
          alert('Invalid backup format. Must be a list of invoices.');
          return false;
        }
        const currentList = this.getAllInvoices();
        let addedCount = 0;
        let updatedCount = 0;

        imported.forEach(imp => {
          if (!imp.number) return;
          const idx = currentList.findIndex(c => c.number.trim().toLowerCase() === imp.number.trim().toLowerCase());
          if (idx >= 0) {
            currentList[idx] = imp;
            updatedCount++;
          } else {
            currentList.push(imp);
            addedCount++;
          }
        });

        this.saveAllInvoices(currentList);
        return { success: true, added: addedCount, updated: updatedCount, total: currentList.length };
      } catch(err) {
        console.error('Import Error:', err);
        alert('Failed to parse backup JSON file: ' + err.message);
        return false;
      }
    },

    // Cloud Sync Configuration (Firebase Realtime Database REST API)
    getCloudUrl: function() {
      return localStorage.getItem(CLOUD_CONFIG_KEY) || '';
    },

    setCloudUrl: function(url) {
      const cleanUrl = (url || '').trim().replace(/\/+$/, '');
      if (cleanUrl) {
        localStorage.setItem(CLOUD_CONFIG_KEY, cleanUrl);
      } else {
        localStorage.removeItem(CLOUD_CONFIG_KEY);
      }
      return cleanUrl;
    },

    // Sync current list to Cloud Database (if configured)
    syncToCloud: async function(list) {
      const cloudUrl = this.getCloudUrl();
      if (!cloudUrl) return;

      const endpoint = cloudUrl.endsWith('.json') ? cloudUrl : `${cloudUrl}/invoices.json`;
      try {
        await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(list)
        });
        console.log('Successfully synced to cloud database!');
      } catch(e) {
        console.warn('Cloud sync error (offline or unreachable):', e);
      }
    },

    // Fetch latest invoices from Cloud Database (bidirectional sync)
    fetchFromCloud: async function() {
      const cloudUrl = this.getCloudUrl();
      if (!cloudUrl) return null;

      const endpoint = cloudUrl.endsWith('.json') ? cloudUrl : `${cloudUrl}/invoices.json`;
      try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          // Merge local and cloud data
          const localList = this.getAllInvoices();
          const mergedMap = new Map();

          // Put local items first
          localList.forEach(item => {
            if (item.number) mergedMap.set(item.number.toLowerCase(), item);
          });

          // Cloud items override or add
          data.forEach(item => {
            if (!item || !item.number) return;
            const key = item.number.toLowerCase();
            if (!mergedMap.has(key)) {
              mergedMap.set(key, item);
            } else {
              // Compare timestamps
              const localItem = mergedMap.get(key);
              const cloudTime = new Date(item.updatedAt || 0).getTime();
              const localTime = new Date(localItem.updatedAt || 0).getTime();
              if (cloudTime > localTime) {
                mergedMap.set(key, item);
              }
            }
          });

          const finalList = Array.from(mergedMap.values());
          localStorage.setItem(STORAGE_KEY, JSON.stringify(finalList));
          return finalList;
        }
      } catch(e) {
        console.warn('Fetch from cloud error:', e);
      }
      return null;
    }
  };

  // Expose to window
  window.DB = DB;

})(window);
