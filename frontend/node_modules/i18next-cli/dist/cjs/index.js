'use strict';

var config = require('./config.js');
var extractor = require('./extractor/core/extractor.js');
var keyFinder = require('./extractor/core/key-finder.js');
var translationManager = require('./extractor/core/translation-manager.js');
require('node:module');
var linter = require('./linter.js');
var syncer = require('./syncer.js');
var status = require('./status.js');
var typesGenerator = require('./types-generator.js');
var renameKey = require('./rename-key.js');
var instrumenter = require('./instrumenter/core/instrumenter.js');
require('./utils/jsx-attributes.js');
require('magic-string');
var localize = require('./localize/localize.js');
require('node:fs/promises');
require('node:path');
var agentPrompt = require('./localize/agent-prompt.js');



exports.defineConfig = config.defineConfig;
exports.extract = extractor.extract;
exports.runExtractor = extractor.runExtractor;
exports.findKeys = keyFinder.findKeys;
exports.getTranslations = translationManager.getTranslations;
exports.recommendedAcceptedAttributes = linter.recommendedAcceptedAttributes;
exports.recommendedAcceptedTags = linter.recommendedAcceptedTags;
exports.runLinter = linter.runLinter;
exports.runSyncer = syncer.runSyncer;
exports.runStatus = status.runStatus;
exports.runUnusedReport = status.runUnusedReport;
exports.runTypesGenerator = typesGenerator.runTypesGenerator;
exports.runRenameKey = renameKey.runRenameKey;
exports.runInstrumenter = instrumenter.runInstrumenter;
exports.writeExtractedKeys = instrumenter.writeExtractedKeys;
exports.runLocalize = localize.runLocalize;
exports.AGENT_PROMPT = agentPrompt.AGENT_PROMPT;
