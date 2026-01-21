/* ============================================================================
   Configuration Save / Load / Import / Export
   ============================================================================
   Functions for saving, loading, importing, and exporting kiosk configurations.
   ============================================================================ */

const CONFIG_SCHEMA_VERSION = 1;
let configFileHandle = null;

/* ============================================================================
   Config Snapshot Functions
   ============================================================================ */

function getConfigSaveName() {
    const configName = dom.get('configName').value.trim();
    if (configName) {
        const sanitized = configName.replace(/\s+/g, '-').replace(/[<>:"/\\|?*]/g, '');
        return `AssignedAccess-${sanitized}.kioskoverseer.json`;
    }
    return 'AssignedAccessConfig.kioskoverseer.json';
}

function collectFormValues() {
    const values = {};
    document.querySelectorAll('input, select, textarea').forEach(el => {
        if (!el.id || el.type === 'file') return;
        if (el.dataset && el.dataset.configSkip === 'true') return;
        if (el.type === 'checkbox') {
            values[el.id] = !!el.checked;
            return;
        }
        if (el.type === 'radio') {
            values[el.id] = !!el.checked;
            return;
        }
        values[el.id] = el.value;
    });
    return values;
}

function buildConfigSnapshot() {
    return {
        schemaVersion: CONFIG_SCHEMA_VERSION,
        name: dom.get('configName').value.trim() || 'Unnamed',
        savedAt: new Date().toISOString(),
        payload: {
            state: {
                mode: state.mode,
                accountType: state.accountType,
                allowedApps: state.allowedApps,
                startPins: state.startPins,
                taskbarPins: state.taskbarPins,
                autoLaunchApp: state.autoLaunchApp
            },
            formValues: collectFormValues()
        }
    };
}

/* ============================================================================
   Save Functions
   ============================================================================ */

async function writeConfigToHandle(handle, config) {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(config, null, 2));
    await writable.close();
}

async function saveConfigAs(existingConfig) {
    const config = existingConfig || buildConfigSnapshot();
    downloadFile(JSON.stringify(config, null, 2), getConfigSaveName(), 'application/json');
}

/* ============================================================================
   Load Functions
   ============================================================================ */

async function loadConfig() {
    dom.get('configImportInput').click();
}

function normalizeConfigPayload(config) {
    if (!config || typeof config !== 'object') {
        return { ok: false, error: 'Invalid configuration file.' };
    }
    if (config.schemaVersion && config.schemaVersion !== CONFIG_SCHEMA_VERSION) {
        return { ok: false, error: `Unsupported schema version: ${config.schemaVersion}` };
    }
    const payload = config.payload;
    if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Configuration payload missing.' };
    }
    const savedState = payload.state || {};
    return {
        ok: true,
        payload: {
            state: savedState,
            formValues: payload.formValues || {}
        }
    };
}

async function loadConfigFile(file, handle) {
    const text = await file.text();
    let parsed = null;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        alert('This file is not valid JSON.');
        return;
    }

    const normalized = normalizeConfigPayload(parsed);
    if (!normalized.ok) {
        alert(normalized.error);
        return;
    }

    if (!confirm('Loading this configuration will replace your current settings. Continue?')) {
        return;
    }

    applyConfigSnapshot(normalized.payload);
    configFileHandle = handle || null;
    alert('Configuration loaded.');
}

function handleConfigImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    loadConfigFile(file, null);
    event.target.value = '';
}

function applyConfigSnapshot(payload) {
    loadPreset('blank');

    const savedState = payload.state || {};
    const savedMode = savedState.mode || 'single';
    const savedAccount = savedState.accountType || 'auto';

    // Normalize account type based on mode
    let normalizedAccount = savedAccount;
    if (savedMode === 'restricted' && savedAccount !== 'group' && savedAccount !== 'global') {
        normalizedAccount = 'group';
    }
    if (savedMode !== 'restricted' && (savedAccount === 'group' || savedAccount === 'global')) {
        normalizedAccount = 'auto';
    }

    setMode(savedMode);
    setAccountType(normalizedAccount);

    state.allowedApps = Array.isArray(savedState.allowedApps) ? savedState.allowedApps : [];
    state.startPins = Array.isArray(savedState.startPins) ? savedState.startPins : [];
    state.taskbarPins = Array.isArray(savedState.taskbarPins) ? savedState.taskbarPins : [];
    const autoLaunch = Number.isInteger(savedState.autoLaunchApp) ? savedState.autoLaunchApp : null;

    // Restore form values
    Object.entries(payload.formValues || {}).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (!el || el.type === 'file') return;
        if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = !!value;
            return;
        }
        el.value = value;
    });

    // Update UI
    renderAppList();
    renderPinList();
    renderTaskbarPinList();
    updatePinTargetPresets();
    updateAutoLaunchSelector();

    if (autoLaunch !== null) {
        dom.get('autoLaunchApp').value = String(autoLaunch);
    }
    updateAutoLaunchSelection();
    updateTabVisibility();
    updateAppTypeUI();
    updateEdgeSourceUI();
    updateEdgeTileSourceUI();
    updateMultiEdgeSourceUI();
    updateTaskbarPinTypeUI();
    updateEditTaskbarPinTypeUI();
    updatePinEdgeArgsModeUI();
    updateEditPinEdgeArgsModeUI();
    updateTaskbarPinEdgeArgsModeUI();
    updateEditTaskbarEdgeArgsModeUI();
    updateEdgeArgsVisibility('pin', 'pinTarget', 'pinEdgeArgsGroup');
    updateEdgeArgsVisibility('editPin', 'editPinTarget', 'editPinEdgeArgsGroup');
    updateEdgeArgsVisibility('taskbarPin', 'taskbarPinTarget', 'taskbarPinEdgeArgsGroup');
    updateEdgeArgsVisibility('editTaskbar', 'editTaskbarPinTarget', 'editTaskbarEdgeArgsGroup');
    updateBreakoutUI();
    updatePreview();
}

/* ============================================================================
   XML Import Functions
   ============================================================================ */

function importXml() {
    dom.get('importInput').click();
}

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            parseAndLoadXml(e.target.result);
            alert('XML imported successfully!');
        } catch (err) {
            alert('Failed to parse XML: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function parseAndLoadXml(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const root = doc.documentElement;

    if (!root || root.localName !== 'AssignedAccessConfiguration') {
        throw new Error('Only AssignedAccess configuration XML files are supported.');
    }

    // Profile ID
    const profile = doc.querySelector('Profile');
    if (profile) {
        dom.get('profileId').value = profile.getAttribute('Id') || '';
    }

    // Check for KioskModeApp (single-app) or AllAppsList (multi-app)
    const kioskModeApp = doc.querySelector('KioskModeApp');
    const allAppsList = doc.querySelector('AllAppsList');

    if (kioskModeApp && !allAppsList) {
        parseAndLoadSingleAppXml(doc, kioskModeApp);
    } else if (allAppsList) {
        parseAndLoadMultiAppXml(doc, allAppsList);
    }

    // Account
    parseAndLoadAccountXml(doc);

    updatePreview();
}

function parseAndLoadSingleAppXml(doc, kioskModeApp) {
    setMode('single');

    const aumid = kioskModeApp.getAttribute('AppUserModelId');
    const classicArgs = kioskModeApp.getAttributeNS('http://schemas.microsoft.com/AssignedAccess/2021/config', 'ClassicAppArguments') ||
                       kioskModeApp.getAttribute('v4:ClassicAppArguments');

    if (aumid === 'MSEdge' || (aumid && aumid.includes('Edge'))) {
        dom.get('appType').value = 'edge';
        updateAppTypeUI();

        if (classicArgs) {
            parseEdgeArgsToForm(classicArgs, 'single');
        }
    } else if (aumid) {
        dom.get('appType').value = 'uwp';
        updateAppTypeUI();
        dom.get('uwpAumid').value = aumid;
    } else {
        const classicAppPath = kioskModeApp.getAttributeNS('http://schemas.microsoft.com/AssignedAccess/2021/config', 'ClassicAppPath') ||
                              kioskModeApp.getAttribute('v4:ClassicAppPath');
        if (classicAppPath) {
            dom.get('appType').value = 'win32';
            updateAppTypeUI();
            dom.get('win32Path').value = classicAppPath;
            dom.get('win32Args').value = classicArgs || '';
        }
    }

    // Breakout sequence
    parseAndLoadBreakoutSequence(doc);
}

function parseAndLoadMultiAppXml(doc, allAppsList) {
    setMode('multi');

    state.allowedApps = [];
    state.autoLaunchApp = null;

    const apps = allAppsList.querySelectorAll('App');
    let appIndex = 0;

    apps.forEach(app => {
        const aumid = app.getAttribute('AppUserModelId');
        const path = app.getAttribute('DesktopAppPath');

        if (aumid) {
            state.allowedApps.push({ type: 'aumid', value: aumid });
        } else if (path) {
            state.allowedApps.push({ type: 'path', value: path });
        }

        // Check for AutoLaunch
        const autoLaunch = app.getAttributeNS('http://schemas.microsoft.com/AssignedAccess/201901/config', 'AutoLaunch') ||
                          app.getAttribute('rs5:AutoLaunch');

        if (autoLaunch === 'true') {
            state.autoLaunchApp = appIndex;

            const autoLaunchArgs = app.getAttributeNS('http://schemas.microsoft.com/AssignedAccess/201901/config', 'AutoLaunchArguments') ||
                                  app.getAttribute('rs5:AutoLaunchArguments');

            if (autoLaunchArgs) {
                const currentAppPath = path || aumid;
                if (isEdgeApp(currentAppPath)) {
                    parseEdgeArgsToForm(autoLaunchArgs, 'multi');
                } else if (path) {
                    dom.get('win32AutoLaunchArgs').value = autoLaunchArgs;
                }
            }
        }
        appIndex++;
    });

    renderAppList();
    updateAutoLaunchSelector();

    if (state.autoLaunchApp !== null) {
        dom.get('autoLaunchApp').value = state.autoLaunchApp;
        updateMultiAppEdgeUI();
    }

    // Start Pins
    parseAndLoadStartPins(doc);
    renderPinList();

    // Taskbar
    const taskbar = doc.querySelector('Taskbar') ||
                   Array.from(doc.querySelectorAll('*')).find(el => el.localName === 'Taskbar');
    if (taskbar) {
        dom.get('showTaskbar').checked = taskbar.getAttribute('ShowTaskbar') === 'true';
    }

    // File Explorer restrictions
    parseAndLoadFileExplorerRestrictions(doc);
}

function parseEdgeArgsToForm(args, mode) {
    const urlMatch = args.match(/--kiosk\s+(\S+)/);
    if (urlMatch) {
        const extractedUrl = urlMatch[1];
        const isFile = extractedUrl.toLowerCase().startsWith('file:///');

        if (mode === 'single') {
            dom.get('edgeSourceType').value = isFile ? 'file' : 'url';
            if (isFile) {
                let filePath = extractedUrl.substring(8);
                filePath = decodeURIComponent(filePath);
                dom.get('edgeFilePath').value = filePath;
                dom.get('edgeUrl').value = '';
            } else {
                dom.get('edgeUrl').value = extractedUrl;
                dom.get('edgeFilePath').value = '';
            }
            updateEdgeSourceUI();
            dom.get('edgeKioskType').value = args.includes('public-browsing') ? 'public-browsing' : 'fullscreen';
        } else {
            dom.get('multiEdgeSourceType').value = isFile ? 'file' : 'url';
            if (isFile) {
                let filePath = extractedUrl.substring(8);
                filePath = decodeURIComponent(filePath);
                dom.get('multiEdgeFilePath').value = filePath;
                dom.get('multiEdgeUrl').value = '';
            } else {
                dom.get('multiEdgeUrl').value = extractedUrl;
                dom.get('multiEdgeFilePath').value = '';
            }
            updateMultiEdgeSourceUI();
            dom.get('multiEdgeKioskType').value = args.includes('public-browsing') ? 'public-browsing' : 'fullscreen';
        }
    }
}

function parseAndLoadBreakoutSequence(doc) {
    const breakoutSequence = doc.querySelector('BreakoutSequence, [*|BreakoutSequence]') ||
                            Array.from(doc.querySelectorAll('*')).find(el => el.localName === 'BreakoutSequence');
    const breakoutKey = breakoutSequence ? breakoutSequence.getAttribute('Key') : null;

    if (breakoutKey) {
        dom.get('enableBreakout').checked = true;
        updateBreakoutUI();

        const parts = breakoutKey.split('+');
        const finalKey = parts[parts.length - 1].toUpperCase();

        dom.get('breakoutCtrl').checked = breakoutKey.toLowerCase().includes('ctrl');
        dom.get('breakoutAlt').checked = breakoutKey.toLowerCase().includes('alt');
        dom.get('breakoutShift').checked = breakoutKey.toLowerCase().includes('shift');

        const finalKeySelect = dom.get('breakoutFinalKey');
        for (let option of finalKeySelect.options) {
            if (option.value === finalKey) {
                finalKeySelect.value = finalKey;
                break;
            }
        }
        updateBreakoutPreview();
    } else {
        dom.get('enableBreakout').checked = false;
        updateBreakoutUI();
    }
}

function parseAndLoadStartPins(doc) {
    state.startPins = [];

    const startPins = doc.querySelector('StartPins') ||
                     Array.from(doc.querySelectorAll('*')).find(el => el.localName === 'StartPins');

    if (startPins) {
        try {
            const pinsJson = JSON.parse(startPins.textContent);
            if (pinsJson.pinnedList) {
                pinsJson.pinnedList.forEach(pin => {
                    if (pin.desktopAppLink) {
                        const path = pin.desktopAppLink;
                        let name = path;

                        const match = path.match(/([^\\\/]+)\.lnk$/i);
                        if (match) {
                            name = match[1];
                        }

                        state.startPins.push({
                            name: name,
                            pinType: 'desktopAppLink',
                            target: '',
                            systemShortcut: path,
                            args: '',
                            workingDir: '',
                            iconPath: ''
                        });
                    } else if (pin.packagedAppId) {
                        state.startPins.push({
                            name: pin.packagedAppId,
                            pinType: 'packagedAppId',
                            packagedAppId: pin.packagedAppId
                        });
                    } else if (pin.secondaryTile) {
                        state.startPins.push({
                            name: pin.secondaryTile.displayName || 'Edge Site',
                            pinType: 'secondaryTile',
                            packagedAppId: pin.secondaryTile.packagedAppId || 'Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!App',
                            args: pin.secondaryTile.arguments || '',
                            tileId: pin.secondaryTile.tileId || ''
                        });
                    }
                });
            }
        } catch (e) {
            console.warn('Failed to parse StartPins JSON:', e.message);
        }
    }
}

function parseAndLoadFileExplorerRestrictions(doc) {
    const fileExplorerRestrictions = doc.querySelector('FileExplorerNamespaceRestrictions') ||
                                    Array.from(doc.querySelectorAll('*')).find(el => el.localName === 'FileExplorerNamespaceRestrictions');

    if (fileExplorerRestrictions) {
        const downloads = fileExplorerRestrictions.querySelector('AllowedNamespace[Name="Downloads"]') ||
                         Array.from(fileExplorerRestrictions.querySelectorAll('*')).find(el => el.localName === 'AllowedNamespace' && el.getAttribute('Name') === 'Downloads');
        const removable = fileExplorerRestrictions.querySelector('AllowRemovableDrives') ||
                         Array.from(fileExplorerRestrictions.querySelectorAll('*')).find(el => el.localName === 'AllowRemovableDrives');
        const noRestriction = fileExplorerRestrictions.querySelector('NoRestriction') ||
                             Array.from(fileExplorerRestrictions.querySelectorAll('*')).find(el => el.localName === 'NoRestriction');

        if (noRestriction) {
            dom.get('fileExplorerAccess').value = 'all';
        } else if (downloads && removable) {
            dom.get('fileExplorerAccess').value = 'downloads-removable';
        } else if (downloads) {
            dom.get('fileExplorerAccess').value = 'downloads';
        } else if (removable) {
            dom.get('fileExplorerAccess').value = 'removable';
        } else {
            dom.get('fileExplorerAccess').value = 'none';
        }
    } else {
        dom.get('fileExplorerAccess').value = 'none';
    }
}

function parseAndLoadAccountXml(doc) {
    const autoLogon = doc.querySelector('AutoLogonAccount');
    const account = doc.querySelector('Config Account');

    if (autoLogon) {
        setAccountType('auto');
        const displayName = autoLogon.getAttributeNS('http://schemas.microsoft.com/AssignedAccess/201901/config', 'DisplayName') ||
                           autoLogon.getAttribute('rs5:DisplayName') ||
                           autoLogon.getAttribute('DisplayName');
        dom.get('displayName').value = displayName || '';
    } else if (account) {
        setAccountType('existing');
        dom.get('accountName').value = account.textContent || '';
    }
}

/* ============================================================================
   Preset Loading
   ============================================================================ */

function loadPreset(preset) {
    // Reset state
    state.allowedApps = [];
    state.startPins = [];
    state.taskbarPins = [];
    state.autoLaunchApp = null;
    configFileHandle = null;

    // Reset config name
    dom.get('configName').value = '';

    // Reset multi-app Edge config
    dom.get('multiEdgeSourceType').value = 'url';
    dom.get('multiEdgeUrl').value = '';
    dom.get('multiEdgeFilePath').value = '';
    dom.get('multiEdgeKioskType').value = 'fullscreen';
    dom.get('win32AutoLaunchArgs').value = '';
    updateMultiEdgeSourceUI();

    switch (preset) {
        case 'blank':
            setMode('single');
            setAccountType('auto');
            generateGuid();
            dom.get('displayName').value = '';
            dom.get('appType').value = 'edge';
            dom.get('edgeSourceType').value = 'url';
            dom.get('edgeUrl').value = '';
            dom.get('edgeFilePath').value = '';
            dom.get('edgeKioskType').value = 'fullscreen';
            updateAppTypeUI();
            updateEdgeSourceUI();
            break;

        case 'edgeFullscreen':
            setMode('single');
            setAccountType('auto');
            generateGuid();
            dom.get('displayName').value = 'Kiosk';
            dom.get('appType').value = 'edge';
            dom.get('edgeSourceType').value = 'url';
            dom.get('edgeUrl').value = 'https://www.microsoft.com';
            dom.get('edgeFilePath').value = '';
            dom.get('edgeKioskType').value = 'fullscreen';
            updateAppTypeUI();
            updateEdgeSourceUI();
            break;

        case 'edgePublic':
            setMode('single');
            setAccountType('auto');
            generateGuid();
            dom.get('displayName').value = 'Public Browsing';
            dom.get('appType').value = 'edge';
            dom.get('edgeSourceType').value = 'url';
            dom.get('edgeUrl').value = 'https://www.bing.com';
            dom.get('edgeFilePath').value = '';
            dom.get('edgeKioskType').value = 'public-browsing';
            updateAppTypeUI();
            updateEdgeSourceUI();
            break;

        case 'multiApp':
            setMode('multi');
            setAccountType('auto');
            generateGuid();
            dom.get('displayName').value = 'Multi-App Kiosk';
            addCommonApp('edge');
            addCommonApp('osk');
            addCommonApp('calculator');
            dom.get('showTaskbar').checked = true;
            dom.get('fileExplorerAccess').value = 'downloads';
            break;
    }

    updateAppTypeUI();
    renderAppList();
    renderPinList();
    renderTaskbarPinList();
    updateAutoLaunchSelector();
    updatePreview();
}
