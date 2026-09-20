type CaderactPoint = Readonly<{ x: number; y: number }>;

type CaderactPromptPresentation = Readonly<{
  commandName?: string;
  instruction?: string;
}>;

type CaderactCommandOption = Readonly<{
  id: string;
  label: string;
  value?: string | number | boolean;
  enabled?: boolean;
  showValue?: boolean;
}>;

interface CaderactCommandOutcome {
  status: string;
  reason?: string;
  command?: string;
  input?: string;
  message?: string;
  formattedMeasurement?: { summary?: string };
}

interface CaderactCommandActivationContext {
  preselectionIds: readonly string[];
  setPrompt(message: string, presentation?: CaderactPromptPresentation | null): void;
}

interface CaderactCommandSession {
  name: string;
  prompt?: string;
  promptPresentation?: CaderactPromptPresentation | null;
  options?: readonly CaderactCommandOption[];
  acceptsEmptyInput?: boolean;
  activationOutcome?: CaderactCommandOutcome;
  finish(): CaderactCommandOutcome;
  cancel(): CaderactCommandOutcome;
  handleInput?(input: string, context?: object): CaderactCommandOutcome;
  handlePointerDown?(point: CaderactPoint, context?: object): CaderactCommandOutcome;
  handleOption?(optionId?: string): CaderactCommandOutcome;
}

interface CaderactCommandDefinition {
  name: string;
  aliases?: readonly string[];
  priority?: number;
  repeatable?: boolean;
  activate(context: CaderactCommandActivationContext): CaderactCommandSession;
}

interface CaderactCommandMatch {
  command: CaderactCommandDefinition;
  category: number;
  field: "canonical" | "alias";
  candidate: string;
  indices: readonly number[];
}

interface CaderactCommandRegistryInstance {
  resolve(value: string): CaderactCommandDefinition | null;
  matches(value: string): readonly CaderactCommandDefinition[];
  search(value: string, options?: { limit?: number }): readonly CaderactCommandMatch[];
}

interface CaderactCommandRouter {
  readonly activeSession: CaderactCommandSession | null;
  readonly currentPrompt: string;
  readonly currentPromptPresentation: CaderactPromptPresentation | null;
  readonly isActive: boolean;
  execute(input: string): CaderactCommandOutcome;
  finishActive(): CaderactCommandOutcome;
  cancelActive(): CaderactCommandOutcome;
  submitActiveInput(input: string, context?: object): CaderactCommandOutcome;
  activateOption(optionId?: string): CaderactCommandOutcome;
  subscribe(listener: (outcome: CaderactCommandOutcome) => unknown): () => boolean;
}

interface CaderactCommandFeedbackController {
  setActivePrompt(message: string, options?: readonly CaderactCommandOption[], presentation?: CaderactPromptPresentation | null): void;
  presentResult(outcome: CaderactCommandOutcome): CaderactCommandOutcome;
  showTemporary(message: string, kind?: string): void;
}

interface CaderactViewportCommandSurface {
  createAlignedDimensionCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createAngularDimensionCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createRadialDimensionCommandSession(name: "DimRadius" | "DimDiameter", mode: "radius" | "diameter", context: CaderactCommandActivationContext): CaderactCommandSession;
  createArcCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createBlockCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createBlockEditCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createInsertCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createAngleMeasurementCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createObjectMeasurementCommandSession(kind: "Area" | "Length" | "Perimeter" | "Radius" | "Diameter", context: CaderactCommandActivationContext): CaderactCommandSession;
  createCircleCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createLinearDimensionCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createCopyCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createDeleteCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createExplodeCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createDistanceCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createDistanceObjectCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createDistanceSumCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createEllipseCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createExtendCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createLineCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createMinDistanceCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createMirrorCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createMoveCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createOffsetCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createPolygonCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createPolylineCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createRectangleCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createRotateCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createScaleCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createTrimCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createTextCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createRegionCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  createHatchCommandSession(context: CaderactCommandActivationContext): CaderactCommandSession;
  cancelDynamicInputEdit?(): void;
  cancelGripEdit(): void;
  selectAllCommittedGeometry(): CaderactCommandOutcome;
  setCommandActive(active: boolean): void;
}

interface CaderactSelectionSurface {
  selectedIds(): readonly string[];
  clear(): void;
}

interface Window {
  CaderactCommandRegistry: {
    createRegistry(definitions: readonly CaderactCommandDefinition[]): CaderactCommandRegistryInstance;
  };
  CaderactCommandRouter: {
    createRouter(options: {
      registry: CaderactCommandRegistryInstance;
      setPrompt(message: string, presentation?: CaderactPromptPresentation | null): void;
      getPreselectionIds?(): readonly string[];
    }): CaderactCommandRouter;
  };
  CaderactCommandFeedback: {
    createController(options: {
      setDisplay(message: string, kind: string, options: readonly CaderactCommandOption[], presentation: CaderactPromptPresentation | null): void;
      setHistory(entries: readonly { message: string; kind: string }[]): void;
    }): CaderactCommandFeedbackController;
  };
  caderactViewport: CaderactViewportCommandSurface;
  caderactSelection?: CaderactSelectionSurface;
  caderactGrips?: { readonly isActive: boolean };
  caderactCommandRegistry?: CaderactCommandRegistryInstance;
  caderactCommandRouter?: CaderactCommandRouter;
  caderactFeedback?: CaderactCommandFeedbackController;
  caderactCommandInput?: {
    acceptIdleCommandSuggestion(): boolean;
    submitCurrentInput(): boolean;
  };
}

interface KeyboardEvent {
  caderactDynamicInputHandled?: boolean;
  caderactSelectionBoxHandled?: boolean;
}
