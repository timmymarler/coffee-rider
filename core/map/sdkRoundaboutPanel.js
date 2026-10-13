export function getSdkRoundaboutPanel(instruction) {
  const entry = instruction?.instructionType === 'RoundaboutGuidanceInstruction';
  const exit = instruction?.instructionType === 'ExitRoundaboutGuidanceInstruction';
  if (!entry && !exit) return null;
  const parsedExit = Number(instruction.roundaboutExitNumber);
  const exitNumber = Number.isInteger(parsedExit) && parsedExit > 0 ? parsedExit : null;
  const angle = instruction.roundaboutTurnAngle;
  const turnAngle = angle != null && Number.isFinite(Number(angle)) ? Number(angle) : null;
  const road = instruction.roadName || instruction.signpostTowardName;
  const text = exitNumber
    ? `Take exit ${exitNumber}${road ? ` onto ${road}` : ''}`
    : instruction.displayText || (exit ? 'Exit roundabout' : 'Enter roundabout');
  return {
    maneuver: exit ? 'ROUNDABOUT_EXIT' : 'ROUNDABOUT_ENTER',
    text,
    exitNumber,
    turnAngle,
  };
}