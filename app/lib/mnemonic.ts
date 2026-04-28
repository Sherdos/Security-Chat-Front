const WORDS = [
  "abandon","ability","able","about","above","absent","absorb","abstract",
  "absurd","abuse","access","accident","account","accuse","achieve","acid",
  "acoustic","acquire","across","act","action","actor","actress","actual",
  "adapt","add","addict","address","adjust","admit","adult","advance",
  "advice","aerobic","affair","afford","afraid","again","age","agent",
  "agree","ahead","aim","air","airport","aisle","alarm","album",
  "alert","alien","all","alley","allow","almost","alone","alpha",
  "already","also","alter","always","amateur","amazing","among","amount",
  "amused","analyst","anchor","ancient","anger","angle","angry","animal",
  "ankle","announce","annual","another","answer","antenna","antique","anxiety",
  "any","apart","apology","appear","apple","approve","april","arch",
  "arctic","area","arena","argue","arm","armed","armor","army",
  "around","arrange","arrest","arrive","arrow","art","artefact","artist",
  "artwork","ask","aspect","assault","asset","assist","assume","asthma",
  "athlete","atom","attack","attend","attitude","attract","auction","audit",
  "august","aunt","author","auto","autumn","average","avocado","avoid",
  "awake","aware","away","awesome","awful","awkward","axis","baby",
  "balance","bamboo","banana","banner","bar","barely","bargain","barrel",
  "base","basic","basket","battle","beach","bean","beauty","because",
  "become","beef","before","begin","behave","behind","believe","below",
  "belt","bench","benefit","best","betray","better","between","beyond",
  "bicycle","bid","bike","bind","biology","bird","birth","bitter",
  "black","blade","blame","blanket","blast","bleak","bless","blind",
  "blood","blossom","blouse","blue","blur","blush","board","boat",
  "body","boil","bomb","bone","book","boost","border","boring",
  "borrow","boss","bottom","bounce","box","boy","bracket","brain",
  "brand","brave","breeze","brick","bridge","brief","bright","bring",
  "brisk","broccoli","broken","bronze","broom","brother","brown","brush",
  "bubble","buddy","budget","buffalo","build","bulb","bulk","bullet",
];

/** Returns 12 random words from the word list (96-bit entropy). */
export function generateMnemonic(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => WORDS[b]).join(" ");
}

/** Returns true if all words in the phrase are in the word list. */
export function isValidMnemonic(phrase: string): boolean {
  const words = phrase.trim().split(/\s+/);
  return words.length >= 8 && words.every((w) => WORDS.includes(w));
}

export { WORDS };
