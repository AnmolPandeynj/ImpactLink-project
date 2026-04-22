/**
 * ImpactLink Skill Match Score Module
 *
 * Provides a fuzzy semantic affinity matrix for matching volunteer skills
 * to mission need types. Replaces the old binary (1 or 0.4) matching.
 *
 * Design principle: Take the MAX affinity across all a volunteer's skills —
 * specialists are rewarded, generalists aren't penalized.
 *
 * Affinity scale: 0.0 (no relation) → 1.0 (exact match)
 */

/**
 * Canonical mission need types (matches Event.eventType / needType):
 * 'Medical', 'Food', 'Water', 'Infrastructure', 'Shelter', 'General'
 *
 * Canonical volunteer skills (matches SKILLS_POOL in seeder):
 * 'First Aid', 'Logistics', 'Medical (Doctor)', 'Search & Rescue',
 * 'Technical Support', 'Counseling', 'Language Translation',
 * 'Driving (Heavy Vehicles)', 'Water Sanitation', 'Community Outreach'
 */

// ─── Affinity Matrix ────────────────────────────────────────────────────────
// Format: SKILL_AFFINITY[volunteerSkill][missionNeedType] = score (0.0–1.0)
// Asymmetric is fine — a Doctor should score high for Medical missions
// but "Community Outreach" should score low for Medical missions.

export const SKILL_AFFINITY = {
  'Medical (Doctor)': {
    Medical:        1.00,
    Food:           0.15,
    Water:          0.20,
    Infrastructure: 0.10,
    Shelter:        0.15,
    General:        0.50,
  },
  'First Aid': {
    Medical:        0.80,
    Food:           0.10,
    Water:          0.15,
    Infrastructure: 0.05,
    Shelter:        0.20,
    General:        0.45,
  },
  'Counseling': {
    Medical:        0.45,
    Food:           0.25,
    Water:          0.10,
    Infrastructure: 0.05,
    Shelter:        0.35,
    General:        0.50,
  },
  'Nursing': {
    Medical:        0.90,
    Food:           0.15,
    Water:          0.20,
    Infrastructure: 0.05,
    Shelter:        0.20,
    General:        0.50,
  },
  'Logistics': {
    Medical:        0.30,
    Food:           0.85,
    Water:          0.70,
    Infrastructure: 0.60,
    Shelter:        0.65,
    General:        0.60,
  },
  'Driving (Heavy Vehicles)': {
    Medical:        0.25,
    Food:           0.80,
    Water:          0.75,
    Infrastructure: 0.65,
    Shelter:        0.70,
    General:        0.55,
  },
  'Water Sanitation': {
    Medical:        0.35,
    Food:           0.40,
    Water:          1.00,
    Infrastructure: 0.45,
    Shelter:        0.25,
    General:        0.40,
  },
  'Technical Support': {
    Medical:        0.15,
    Food:           0.20,
    Water:          0.40,
    Infrastructure: 0.85,
    Shelter:        0.55,
    General:        0.40,
  },
  'Search & Rescue': {
    Medical:        0.60,
    Food:           0.20,
    Water:          0.30,
    Infrastructure: 0.40,
    Shelter:        0.50,
    General:        0.55,
  },
  'Community Outreach': {
    Medical:        0.25,
    Food:           0.60,
    Water:          0.35,
    Infrastructure: 0.20,
    Shelter:        0.55,
    General:        0.65,
  },
  'Language Translation': {
    Medical:        0.20,
    Food:           0.30,
    Water:          0.20,
    Infrastructure: 0.15,
    Shelter:        0.25,
    General:        0.55,
  },
};

// ─── Need Type Normalizer ────────────────────────────────────────────────────
// Maps raw eventType strings from the DB to canonical need types.
// Handles legacy/messy data from field reports.

const NEED_TYPE_ALIASES = {
  'medical shortage':      'Medical',
  'medical':               'Medical',
  'health':                'Medical',
  'health check':          'Medical',
  'food':                  'Food',
  'food shortage':         'Food',
  'relief delivery':       'Food',
  'water':                 'Water',
  'water contamination':   'Water',
  'flood':                 'Water',
  'infrastructure':        'Infrastructure',
  'grid failure':          'Infrastructure',
  'utility failure':       'Infrastructure',
  'structural collapse':   'Infrastructure',
  'shelter':               'Shelter',
  'idp movement':          'Shelter',
  'displacement':          'Shelter',
  'general':               'General',
};

/**
 * Normalize a raw need type string to a canonical category.
 * Case-insensitive. Returns 'General' if unrecognized.
 *
 * @param {string} rawNeedType
 * @returns {string} Canonical need type
 */
export function normalizeNeedType(rawNeedType) {
  if (!rawNeedType) return 'General';
  const lower = rawNeedType.toLowerCase().trim();
  return NEED_TYPE_ALIASES[lower] || 'General';
}

/**
 * Compute the skill match score between a volunteer's skill set and a mission.
 *
 * Takes the MAX affinity across all skills — a volunteer who has both
 * "First Aid" (0.80) and "Community Outreach" (0.25) for a Medical mission
 * scores 0.80, not 0.525.
 *
 * @param {string[]} volunteerSkills - Array of skill strings from Volunteer.skills
 * @param {string} missionNeedType - Raw eventType or needType from the mission
 * @returns {number} Score from 0.0 to 1.0
 */
export function getSkillMatchScore(volunteerSkills, missionNeedType) {
  if (!volunteerSkills || volunteerSkills.length === 0) return 0.1;

  const canonicalNeed = normalizeNeedType(missionNeedType);
  let maxScore = 0;

  for (const skill of volunteerSkills) {
    const affinityRow = SKILL_AFFINITY[skill];
    if (!affinityRow) {
      // Unknown skill — give a small baseline score
      maxScore = Math.max(maxScore, 0.15);
      continue;
    }
    const score = affinityRow[canonicalNeed] ?? 0.15;
    maxScore = Math.max(maxScore, score);
  }

  return parseFloat(maxScore.toFixed(3));
}

/**
 * Get the top skill match explanation for UI display.
 * Returns the skill that contributed the winning score.
 *
 * @param {string[]} volunteerSkills
 * @param {string} missionNeedType
 * @returns {{ skill: string, score: number, needType: string }}
 */
export function getTopSkillMatch(volunteerSkills, missionNeedType) {
  const canonicalNeed = normalizeNeedType(missionNeedType);
  let topSkill = null;
  let topScore = 0;

  for (const skill of (volunteerSkills || [])) {
    const affinityRow = SKILL_AFFINITY[skill];
    if (!affinityRow) continue;
    const score = affinityRow[canonicalNeed] ?? 0.15;
    if (score > topScore) {
      topScore = score;
      topSkill = skill;
    }
  }

  return {
    skill: topSkill || volunteerSkills?.[0] || 'General',
    score: parseFloat(topScore.toFixed(3)),
    needType: canonicalNeed,
  };
}
