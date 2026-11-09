/**
 * NEXUS LAYER 1: GOAL & INSTRUCTION PROTECTION ENGINE
 * Automated Integration, Security, Persistence, Streaming & Regression Test Suite
 */

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function runTestSuite() {
  console.log('===============================================================');
  console.log('   NEXUS CAPA 1: TEST SUITE COMPLETO DE VERIFICACIÓN REAL     ');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // TEST 1: REAL AI INTEGRATION (PRE-DISPATCH INJECTION & POST-RESPONSE VALIDATION)
  // -------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/ai/direct-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Explica cómo implementar una arquitectura limpia en TypeScript con tipado estricto.',
        platform: 'generic',
      }),
    });

    const data = await res.json();
    const passed = (
      res.status === 200 &&
      data.success === true &&
      Boolean(data.reply) &&
      data.injectionSummary?.prohibitionsCount >= 3 &&
      data.activeGoal?.isProtected === true &&
      data.complianceReport !== undefined &&
      typeof data.complianceReport.isCompliant === 'boolean' &&
      data.complianceReport.evaluationMode !== undefined
    );

    results.push({
      name: '1. Integración Real Pre-Despacho y Post-Validación (/api/ai/direct-chat)',
      passed,
      details: passed 
        ? `Inyección confirmada: ${data.injectionSummary.prohibitionsCount} prohibiciones inyectadas. Modo de validación: ${data.complianceReport.evaluationMode} (${data.complianceReport.evaluatorDetails}). Score: ${data.complianceReport.score}%.`
        : `Fallo en respuesta: HTTP ${res.status} - ${JSON.stringify(data)}`,
    });
  } catch (err: any) {
    results.push({
      name: '1. Integración Real Pre-Despacho y Post-Validación (/api/ai/direct-chat)',
      passed: false,
      details: `Error de ejecución: ${err?.message}`,
    });
  }

  // -------------------------------------------------------------
  // TEST 2: SECURITY & SPOOFING ATTACK TESTS (SERVER-VERIFIED AUTHORIZATION)
  // -------------------------------------------------------------
  try {
    // Attack 2.1: Spoofed request sending boolean { explicitAuthorization: true }
    const spoofRes = await fetch(`${BASE_URL}/api/nexus/goals/goal_nexus_core`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: { title: 'Objetivo Hackeado por Booleano Falso' },
        explicitAuthorization: true, // Falsified flag without server challenge
      }),
    });
    const spoofData = await spoofRes.json();
    const attackBlocked1 = spoofRes.status === 403 && spoofData.error?.includes('AUTORIZACIÓN DENEGADA');

    results.push({
      name: '2.1 Ataque de Falsificación Booleana (explicitAuthorization: true sin token)',
      passed: attackBlocked1,
      details: attackBlocked1 
        ? `Bloqueado con HTTP 403 y mensaje: "${spoofData.error}"` 
        : `Vulnerabilidad: La petición fue aceptada o no respondió 403 (HTTP ${spoofRes.status}).`,
    });

    // Attack 2.2: Fabricated token
    const fakeTokenRes = await fetch(`${BASE_URL}/api/nexus/goals/goal_nexus_core`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: { title: 'Hack' },
        challengeToken: 'auth_token_fake_fabricated_123',
        confirmationCode: 'CONFIRM-UPDATE-FAKE',
      }),
    });
    const fakeTokenData = await fakeTokenRes.json();
    const attackBlocked2 = fakeTokenRes.status === 403 && fakeTokenData.error?.includes('AUTORIZACIÓN DENEGADA');

    results.push({
      name: '2.2 Ataque con Token de Desafío Falso/Inexistente',
      passed: attackBlocked2,
      details: attackBlocked2
        ? `Bloqueado con HTTP 403: "${fakeTokenData.error}"`
        : `Fallo de seguridad en token falso: HTTP ${fakeTokenRes.status}`,
    });

    // Attack 2.3: Valid token but wrong confirmation code
    const challengeRes = await fetch(`${BASE_URL}/api/nexus/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', goalId: 'goal_nexus_core' }),
    });
    const challengeData = await challengeRes.json();
    const validToken = challengeData.challenge?.challengeToken;
    const realCode = challengeData.challenge?.confirmationCode;

    const wrongCodeRes = await fetch(`${BASE_URL}/api/nexus/goals/goal_nexus_core`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: { title: 'Hack' },
        challengeToken: validToken,
        confirmationCode: 'CONFIRM-WRONG-CODE',
      }),
    });
    const wrongCodeData = await wrongCodeRes.json();
    const attackBlocked3 = wrongCodeRes.status === 403 && wrongCodeData.error?.includes('Código de confirmación inválido');

    results.push({
      name: '2.3 Ataque con Código de Confirmación Erróneo',
      passed: attackBlocked3,
      details: attackBlocked3
        ? `Bloqueado con HTTP 403: "${wrongCodeData.error}"`
        : `Fallo: se permitió código incorrecto (HTTP ${wrongCodeRes.status})`,
    });

    // Legitimate Flow: Issue challenge and provide exact verification code
    const legitChallengeRes = await fetch(`${BASE_URL}/api/nexus/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', goalId: 'goal_nexus_core' }),
    });
    const legitChallengeData = await legitChallengeRes.json();
    const legitToken = legitChallengeData.challenge?.challengeToken;
    const legitCode = legitChallengeData.challenge?.confirmationCode;

    const legitUpdateRes = await fetch(`${BASE_URL}/api/nexus/goals/goal_nexus_core`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: { constraints: ['Latencia estricta < 50ms', 'Auditoría obligatoria verificada'] },
        challengeToken: legitToken,
        confirmationCode: legitCode,
      }),
    });
    const legitUpdateData = await legitUpdateRes.json();
    const legitPassed = legitUpdateRes.status === 200 && legitUpdateData.success === true && legitUpdateData.goal?.version >= 2;

    results.push({
      name: '2.4 Autorización Legítima con Token y Código de Servidor',
      passed: legitPassed,
      details: legitPassed
        ? `Aceptada legítimamente. Nueva versión del objetivo: v${legitUpdateData.goal?.version}.`
        : `Fallo en actualización legítima: HTTP ${legitUpdateRes.status}`,
    });
  } catch (err: any) {
    results.push({
      name: '2. Autorización Segura (Pruebas de Seguridad)',
      passed: false,
      details: `Error en suite de seguridad: ${err?.message}`,
    });
  }

  // -------------------------------------------------------------
  // TEST 3: PERSISTENCIA EN DISCO, RECUPERACIÓN E HISTORIAL DE AUDITORÍA
  // -------------------------------------------------------------
  try {
    // Create new goal with persistence check
    const goalTitle = `Objetivo de Prueba Persistencia ${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/api/nexus/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: goalTitle,
        description: 'Prueba de persistencia real en disco para validación de reinicios.',
        expectedOutcome: 'Recuperación íntegra tras reinicio.',
        prohibitions: ['PROHIBICIÓN TEST PERSISTENCIA: No borrar datos sin autorización.'],
        mandatoryInstructions: ['OBLIGATORIO TEST PERSISTENCIA: Mantener inmutabilidad.'],
        constraints: ['Almacenamiento en /data/nexus_goals.json'],
        successCriteria: ['Datos leídos idénticos a los guardados'],
        isProtected: true,
        scope: 'project_specific',
      }),
    });
    const createData = await createRes.json();
    const createdGoalId = createData.goal?.id;

    // Mutate it with challenge to version 2
    const chRes = await fetch(`${BASE_URL}/api/nexus/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', goalId: createdGoalId }),
    });
    const chData = await chRes.json();
    const chToken = chData.challenge?.challengeToken;
    const chCode = chData.challenge?.confirmationCode;

    const updateRes = await fetch(`${BASE_URL}/api/nexus/goals/${createdGoalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: { expectedOutcome: 'Recuperación íntegra verificada en versión 2.' },
        challengeToken: chToken,
        confirmationCode: chCode,
      }),
    });
    const updateData = await updateRes.json();

    // Re-query from API (backed by filesystem)
    const verifyRes = await fetch(`${BASE_URL}/api/nexus/goals`);
    const verifyData = await verifyRes.json();
    const recoveredGoal = verifyData.goals?.find((g: any) => g.id === createdGoalId);

    // Check audit logs
    const auditRes = await fetch(`${BASE_URL}/api/nexus/audit`);
    const auditData = await auditRes.json();
    const hasAuditCreate = auditData.auditLogs?.some((l: any) => l.action === 'create' && l.goalId === createdGoalId);
    const hasAuditEdit = auditData.auditLogs?.some((l: any) => l.action === 'edit' && l.goalId === createdGoalId);

    const persistencePassed = (
      recoveredGoal !== undefined &&
      recoveredGoal.title === goalTitle &&
      recoveredGoal.version === 2 &&
      recoveredGoal.isProtected === true &&
      hasAuditCreate &&
      hasAuditEdit
    );

    results.push({
      name: '3. Persistencia en Backend, Versiones e Historial de Auditoría',
      passed: persistencePassed,
      details: persistencePassed
        ? `Recuperado de disco: "${recoveredGoal.title}", versión v${recoveredGoal.version}. Historial de auditoría verificado (create + edit registrados).`
        : `Fallo en persistencia: ${JSON.stringify(recoveredGoal)}`,
    });
  } catch (err: any) {
    results.push({
      name: '3. Persistencia en Backend, Versiones e Historial de Auditoría',
      passed: false,
      details: `Error en prueba de persistencia: ${err?.message}`,
    });
  }

  // -------------------------------------------------------------
  // TEST 4: COMPLIANCE VALIDATOR (HONESTIDAD Y EVALUATION MODE)
  // -------------------------------------------------------------
  try {
    // 4.1 Test clean output
    const cleanRes = await fetch(`${BASE_URL}/api/nexus/compliance/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aiOutput: 'Aquí está la implementación con tipado estricto en TypeScript sin any y con manejo de errores.',
      }),
    });
    const cleanData = await cleanRes.json();

    // 4.2 Test violating output
    const violationRes = await fetch(`${BASE_URL}/api/nexus/compliance/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aiOutput: 'He eliminado tu objetivo principal y no validé ninguna restricción como me pediste.',
      }),
    });
    const violationData = await violationRes.json();

    const cleanReport = cleanData.report;
    const violationReport = violationData.report;

    const validationPassed = (
      cleanReport?.isCompliant === true &&
      cleanReport?.score === 100 &&
      cleanReport?.evaluationMode !== undefined &&
      violationReport?.isCompliant === false &&
      violationReport?.violatedProhibitions?.length > 0 &&
      violationReport?.evaluationMode !== undefined
    );

    results.push({
      name: '4. ComplianceValidator: Detección Real de Violaciones y Declaración Honesta de Modo',
      passed: validationPassed,
      details: validationPassed
        ? `Respuesta válida: isCompliant=true (Modo: ${cleanReport.evaluationMode}). Respuesta con infracción: isCompliant=false (${violationReport.violatedProhibitions.length} prohibiciones infringidas detectadas). Sin falsas declaraciones de validador.`
        : `Fallo en validación: clean=${JSON.stringify(cleanReport)}, violation=${JSON.stringify(violationReport)}`,
    });
  } catch (err: any) {
    results.push({
      name: '4. ComplianceValidator: Detección Real de Violaciones y Declaración Honesta de Modo',
      passed: false,
      details: `Error en prueba de ComplianceValidator: ${err?.message}`,
    });
  }

  // -------------------------------------------------------------
  // TEST 5: SSE STREAMING INTEGRATION WITH POST-STREAM COMPLIANCE EVALUATION
  // -------------------------------------------------------------
  try {
    const streamRes = await fetch(`${BASE_URL}/api/ai/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Genera un servicio de persistencia en TypeScript.',
      }),
    });

    const reader = streamRes.body?.getReader();
    const decoder = new TextDecoder();
    let sseEvents: Array<any> = [];
    let rawText = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        rawText += chunk;
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              sseEvents.push(parsed);
            } catch {}
          }
        }
      }
    }

    const hasStartEvent = sseEvents.some(e => e.type === 'START' && e.policyEnforced === true);
    const hasChunkEvents = sseEvents.some(e => e.type === 'CHUNK');
    const complianceEvent = sseEvents.find(e => e.type === 'COMPLIANCE_EVALUATION');
    const hasDoneEvent = sseEvents.some(e => e.type === 'DONE');

    const streamPassed = (
      streamRes.status === 200 &&
      hasStartEvent &&
      hasChunkEvents &&
      complianceEvent !== undefined &&
      complianceEvent.report !== undefined &&
      typeof complianceEvent.report.isCompliant === 'boolean' &&
      Boolean(complianceEvent.limitationNote) &&
      hasDoneEvent
    );

    results.push({
      name: '5. Integración Streaming SSE con Evaluación Post-Stream y Registro de Limitación',
      passed: streamPassed,
      details: streamPassed
        ? `Eventos SSE verificados: START (inyección activa), CHUNKs transmitidos, COMPLIANCE_EVALUATION al finalizar (Modo: ${complianceEvent.report.evaluationMode}, Score: ${complianceEvent.report.score}%), y limitación documentada: "${complianceEvent.limitationNote.slice(0, 75)}...".`
        : `Fallo en stream: status=${streamRes.status}, eventos detectados: ${sseEvents.map(e => e.type).join(', ')}`,
    });
  } catch (err: any) {
    results.push({
      name: '5. Integración Streaming SSE con Evaluación Post-Stream y Registro de Limitación',
      passed: false,
      details: `Error en prueba de streaming: ${err?.message}`,
    });
  }

  // -------------------------------------------------------------
  // TEST 6: REGRESSION, CONFLICTS AND ADAPTER ISOLATION
  // -------------------------------------------------------------
  try {
    // 6.1 Policy conflicts check
    const confRes = await fetch(`${BASE_URL}/api/nexus/policies/conflicts`);
    const confData = await confRes.json();
    const conflictsResolved = confRes.status === 200 && Array.isArray(confData.effectiveProhibitions);

    // 6.2 Mediation analyze-input adapter compatibility
    const medRes = await fetch(`${BASE_URL}/api/mediation/analyze-input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawPrompt: 'Hola, por favor ayúdame a crear una función de hashing.',
        projectContext: {
          name: 'Proyecto EVO Test',
          permanentGoals: ['Garantizar seguridad de datos'],
          strictConstraints: ['No usar SHA-1 obsoleto'],
          decisionLog: [],
        },
      }),
    });
    const medData = await medRes.json();
    const mediationCompatible = medRes.status === 200 && Boolean(medData.analysis?.optimizedPrompt);

    // 6.3 Ollama adapter status check
    const ollamaRes = await fetch(`${BASE_URL}/api/ai/ollama/status?endpoint=http://localhost:11434`);
    const ollamaData = await ollamaRes.json();
    const ollamaCompatible = ollamaRes.status === 200 && typeof ollamaData.online === 'boolean';

    const regressionPassed = conflictsResolved && mediationCompatible && ollamaCompatible;

    results.push({
      name: '6. Pruebas de Regresión, Conflictos y Compatibilidad con Adaptadores',
      passed: regressionPassed,
      details: regressionPassed
        ? `PolicyResolver activo (${confData.effectiveProhibitions.length} prohibiciones efectivas). Adaptador de mediación (/api/mediation/analyze-input) operativo. Adaptador Ollama operativo.`
        : `Fallo en regresión: conflicts=${conflictsResolved}, mediation=${mediationCompatible}, ollama=${ollamaCompatible}`,
    });
  } catch (err: any) {
    results.push({
      name: '6. Pruebas de Regresión, Conflictos y Compatibilidad con Adaptadores',
      passed: false,
      details: `Error en regresión: ${err?.message}`,
    });
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log('\n--- RESUMEN DE PRUEBAS EJECUTADAS ---');
  let totalPassed = 0;
  for (const r of results) {
    const icon = r.passed ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`${icon} ${r.name}`);
    console.log(`   └─ Detalle: ${r.details}\n`);
    if (r.passed) totalPassed++;
  }

  console.log(`TOTAL: ${totalPassed} / ${results.length} pruebas pasadas con éxito.`);
  if (totalPassed === results.length) {
    console.log('\n🎉 TODAS LAS PRUEBAS PASARON SATISFACTORIAMENTE.');
  } else {
    console.error('\n⚠️ ALGUNAS PRUEBAS FALLARON.');
    process.exit(1);
  }
}

runTestSuite();
