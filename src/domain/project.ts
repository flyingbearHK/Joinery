import {
  PROJECT_FILE_TYPE,
  PROJECT_FORMAT_VERSION,
  type Attribute,
  type Diagram,
  type Entity,
  type JoineryProject,
  type Point,
  type Relationship,
} from "./model";

function id(prefix: string, value: string): string {
  return `${prefix}_${value}`;
}

export function createId(prefix: string): string {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

  return `${prefix}_${randomId}`;
}

export function createAttribute(
  name = "New attribute",
  logicalType = "Text",
): Attribute {
  return {
    id: createId("attribute"),
    name,
    logicalType,
    description: "",
    isRequired: false,
    isIdentifier: false,
  };
}

export function createEntity(name = "New entity"): Entity {
  return {
    id: createId("entity"),
    name,
    description: "",
    color: "#6d4bb9",
    attributes: [],
    identifiers: [],
  };
}

export function nextEntityPosition(diagram: Diagram): Point {
  const count = Object.keys(diagram.entityViews).length;
  return {
    x: 72 + (count % 3) * 320,
    y: 72 + Math.floor(count / 3) * 250,
  };
}

export function createBlankProject(name = "Untitled model"): JoineryProject {
  const now = new Date().toISOString();
  const overviewId = createId("diagram");

  return {
    fileType: PROJECT_FILE_TYPE,
    formatVersion: PROJECT_FORMAT_VERSION,
    id: createId("project"),
    name,
    description: "",
    settings: { namingConvention: "none", requireDescriptions: false },
    createdAt: now,
    updatedAt: now,
    model: {
      entities: {},
      relationships: {},
      logicalTypes: {},
    },
    diagrams: {
      [overviewId]: {
        id: overviewId,
        name: "Overview",
        description: "",
        entityViews: {},
        relationshipViews: {},
        notes: {},
        subjectAreas: {},
      },
    },
  };
}

export function createSampleProject(): JoineryProject {
  const customerId = id("entity", "customer");
  const orderId = id("entity", "order");
  const lineItemId = id("entity", "line_item");
  const productId = id("entity", "product");

  const entities: Record<string, Entity> = {
    [customerId]: {
      id: customerId,
      name: "Customer",
      description: "A person or organisation that places orders.",
      color: "#6d4bb9",
      attributes: [
        {
          id: id("attribute", "customer_id"),
          name: "customer id",
          logicalType: "Identifier",
          description: "Stable identifier for the customer.",
          isRequired: true,
          isIdentifier: true,
        },
        {
          id: id("attribute", "customer_name"),
          name: "name",
          logicalType: "Text",
          description: "Display name of the customer.",
          isRequired: true,
          isIdentifier: false,
        },
        {
          id: id("attribute", "customer_email"),
          name: "email",
          logicalType: "Email",
          description: "Primary contact email.",
          isRequired: false,
          isIdentifier: false,
        },
      ],
      identifiers: [
        {
          id: id("identifier", "customer_primary"),
          name: "Primary identifier",
          kind: "primary",
          attributeIds: [id("attribute", "customer_id")],
        },
      ],
    },
    [orderId]: {
      id: orderId,
      name: "Order",
      description: "A customer's request to purchase one or more products.",
      color: "#356e9f",
      attributes: [
        {
          id: id("attribute", "order_id"),
          name: "order id",
          logicalType: "Identifier",
          description: "Stable identifier for the order.",
          isRequired: true,
          isIdentifier: true,
        },
        {
          id: id("attribute", "ordered_at"),
          name: "ordered at",
          logicalType: "Date & time",
          description: "When the order was placed.",
          isRequired: true,
          isIdentifier: false,
        },
        {
          id: id("attribute", "order_status"),
          name: "status",
          logicalType: "Text",
          description: "Current stage of the order.",
          isRequired: true,
          isIdentifier: false,
        },
      ],
      identifiers: [
        {
          id: id("identifier", "order_primary"),
          name: "Primary identifier",
          kind: "primary",
          attributeIds: [id("attribute", "order_id")],
        },
      ],
    },
    [lineItemId]: {
      id: lineItemId,
      name: "Order item",
      description: "A product and quantity included in an order.",
      color: "#91652f",
      attributes: [
        {
          id: id("attribute", "line_item_number"),
          name: "item number",
          logicalType: "Number",
          description: "Position of the item within its order.",
          isRequired: true,
          isIdentifier: true,
        },
        {
          id: id("attribute", "line_item_quantity"),
          name: "quantity",
          logicalType: "Number",
          description: "Number of units requested.",
          isRequired: true,
          isIdentifier: false,
        },
        {
          id: id("attribute", "line_item_price"),
          name: "agreed price",
          logicalType: "Decimal",
          description: "Price agreed when the order was placed.",
          isRequired: true,
          isIdentifier: false,
        },
      ],
      identifiers: [
        {
          id: id("identifier", "line_item_primary"),
          name: "Primary identifier",
          kind: "primary",
          attributeIds: [id("attribute", "line_item_number")],
        },
      ],
    },
    [productId]: {
      id: productId,
      name: "Product",
      description: "An item offered to customers.",
      color: "#2f7d76",
      attributes: [
        {
          id: id("attribute", "product_id"),
          name: "product id",
          logicalType: "Identifier",
          description: "Stable identifier for the product.",
          isRequired: true,
          isIdentifier: true,
        },
        {
          id: id("attribute", "product_name"),
          name: "name",
          logicalType: "Text",
          description: "Customer-facing product name.",
          isRequired: true,
          isIdentifier: false,
        },
        {
          id: id("attribute", "product_active"),
          name: "is active",
          logicalType: "Boolean",
          description: "Whether the product can currently be ordered.",
          isRequired: true,
          isIdentifier: false,
        },
      ],
      identifiers: [
        {
          id: id("identifier", "product_primary"),
          name: "Primary identifier",
          kind: "primary",
          attributeIds: [id("attribute", "product_id")],
        },
      ],
    },
  };

  const relationships: Record<string, Relationship> = {
    [id("relationship", "customer_orders")]: {
      id: id("relationship", "customer_orders"),
      name: "places",
      description: "A customer may place multiple orders.",
      kind: "association",
      sourceRole: "customer",
      targetRole: "orders",
      sourceEntityId: customerId,
      targetEntityId: orderId,
      sourceAttributeId: null,
      targetAttributeId: null,
      sourceCardinality: "exactly-one",
      targetCardinality: "zero-or-many",
      isIdentifying: false,
    },
    [id("relationship", "order_items")]: {
      id: id("relationship", "order_items"),
      name: "contains",
      description: "An order contains one or more order items.",
      kind: "association",
      sourceRole: "order",
      targetRole: "items",
      sourceEntityId: orderId,
      targetEntityId: lineItemId,
      sourceAttributeId: null,
      targetAttributeId: null,
      sourceCardinality: "exactly-one",
      targetCardinality: "one-or-many",
      isIdentifying: true,
    },
    [id("relationship", "product_items")]: {
      id: id("relationship", "product_items"),
      name: "appears in",
      description: "A product may appear in many order items.",
      kind: "association",
      sourceRole: "product",
      targetRole: "order items",
      sourceEntityId: productId,
      targetEntityId: lineItemId,
      sourceAttributeId: null,
      targetAttributeId: null,
      sourceCardinality: "exactly-one",
      targetCardinality: "zero-or-many",
      isIdentifying: false,
    },
  };

  const overviewId = id("diagram", "overview");
  const now = new Date().toISOString();

  return {
    fileType: PROJECT_FILE_TYPE,
    formatVersion: PROJECT_FORMAT_VERSION,
    id: id("project", "commerce"),
    name: "Commerce model",
    description: "A sample logical model for the Joinery workspace.",
    settings: { namingConvention: "none", requireDescriptions: false },
    createdAt: now,
    updatedAt: now,
    model: {
      entities,
      relationships,
      logicalTypes: {
        logical_type_money: {
          id: "logical_type_money",
          name: "Money",
          baseType: "Decimal",
          description: "A monetary amount independent of database storage.",
          format: "0.00",
        },
      },
    },
    diagrams: {
      [overviewId]: {
        id: overviewId,
        name: "Overview",
        description: "The main view of the commerce model.",
        entityViews: {
          [customerId]: { x: 80, y: 120, collapsed: false, pinned: false },
          [orderId]: { x: 430, y: 80, collapsed: false, pinned: false },
          [lineItemId]: { x: 780, y: 220, collapsed: false, pinned: false },
          [productId]: { x: 430, y: 400, collapsed: false, pinned: false },
        },
        relationshipViews: {},
        notes: {},
        subjectAreas: {},
      },
    },
  };
}
