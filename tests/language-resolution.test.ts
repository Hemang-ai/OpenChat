import assert from "node:assert/strict";
import test from "node:test";
import {
  detectMessageLanguage,
  resolveResponseLanguage,
  responseUsesExpectedScript,
} from "../lib/i18n/languages.ts";

const supported = ["en", "es", "hi"];

test("detects Hindi script when Hindi is enabled", () => {
  assert.equal(detectMessageLanguage("आपकी वापसी नीति क्या है?", supported), "hi");
});

test("a Hindi question overrides an English widget selection", () => {
  assert.equal(
    resolveResponseLanguage("मुझे कीमत बताइए", "en", supported, "en"),
    "hi"
  );
});

test("detects clear Spanish and English questions", () => {
  assert.equal(detectMessageLanguage("Hola, ¿cómo puedo obtener ayuda?", supported), "es");
  assert.equal(detectMessageLanguage("What is your return policy?", supported), "en");
});

test("keeps the selected locale for ambiguous messages", () => {
  assert.equal(resolveResponseLanguage("SKU-440", "es", supported, "en"), "es");
});

test("never selects a language the bot has not enabled", () => {
  assert.equal(resolveResponseLanguage("आपकी कीमत क्या है?", "en", ["en", "es"], "en"), "en");
});

test("detects when a Hindi response is still written in English", () => {
  assert.equal(responseUsesExpectedScript("Our return policy is 30 days.", "hi"), false);
  assert.equal(responseUsesExpectedScript("हमारी वापसी नीति 30 दिनों की है।", "hi"), true);
  assert.equal(responseUsesExpectedScript("Nuestra política es de 30 días.", "es"), true);
});
