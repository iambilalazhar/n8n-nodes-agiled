import type {
  IDataObject,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  INodeProperties,
} from "n8n-workflow"
import { NodeConnectionTypes } from "n8n-workflow"
import {
  resources,
  type Field,
  type ResourceKey,
} from "../../shared/catalog"
import { agiledApiRequest, cleanObject, unwrapData, unwrapList } from "../../shared/transport"

type JsonObject = IDataObject
type DropdownDefinition = {
  key: string
  labelKey?: string
  path: string
  valueKey?: string
}

const deletableResources = new Set<ResourceKey>([
  "accounts",
  "contacts",
  "deals",
  "documents",
  "estimates",
  "expenses",
  "files",
  "forms",
  "invoices",
  "payments",
  "pipelines",
  "products",
  "projects",
  "tasks",
  "tickets",
  "time_entries",
])

const dropdownDefinitions: DropdownDefinition[] = [
  { key: "list_accounts", path: "/accounts?per_page=50" },
  {
    key: "list_appointments",
    labelKey: "invitee_email",
    path: "/appointments?per_page=50",
  },
  {
    key: "list_booking_pages",
    labelKey: "title",
    path: "/booking-pages?per_page=50",
  },
  {
    key: "list_booking_pages_by_slug",
    labelKey: "title",
    path: "/booking-pages?per_page=50",
    valueKey: "slug",
  },
  { key: "list_contacts", path: "/contacts?per_page=50" },
  { key: "list_deals", path: "/deals?per_page=50" },
  {
    key: "list_documents",
    labelKey: "title",
    path: "/documents?per_page=50",
  },
  {
    key: "list_document_templates",
    path: "/document-templates?per_page=50",
  },
  {
    key: "list_estimates",
    labelKey: "estimate_number",
    path: "/estimates?per_page=50",
  },
  { key: "list_event_types", path: "/event-types?per_page=50" },
  {
    key: "list_event_types_by_slug",
    path: "/event-types?per_page=50",
    valueKey: "slug",
  },
  {
    key: "list_expenses",
    labelKey: "vendor",
    path: "/expenses?per_page=50",
  },
  { key: "list_files", path: "/files?per_page=50" },
  { key: "list_forms", path: "/forms?per_page=50" },
  {
    key: "list_invoices",
    labelKey: "invoice_number",
    path: "/invoices?per_page=50",
  },
  {
    key: "list_payments",
    labelKey: "amount",
    path: "/payments?per_page=50",
  },
  { key: "list_pipelines", path: "/pipelines?per_page=50" },
  { key: "list_products", path: "/products?per_page=50" },
  { key: "list_projects", path: "/projects?per_page=50" },
  { key: "list_tasks", labelKey: "title", path: "/tasks?per_page=50" },
  {
    key: "list_tickets",
    labelKey: "subject",
    path: "/tickets?per_page=50",
  },
  {
    key: "list_time_entries",
    labelKey: "description",
    path: "/time-entries?per_page=50",
  },
  { key: "list_users", path: "/users?per_page=50" },
]

const dropdownMethodByKey = Object.fromEntries(
  dropdownDefinitions.map((definition) => [
    definition.key,
    definition.key.replace(/_([a-z])/g, (_, letter: string) =>
      letter.toUpperCase(),
    ),
  ]),
) as Record<string, string>

function optionLabel(item: JsonObject, labelKey?: string) {
  if (labelKey && item[labelKey] != null && item[labelKey] !== "") {
    return String(item[labelKey])
  }

  const fullName = [item.first_name, item.last_name].filter(Boolean).join(" ")

  return String(
    item.name || item.title || item.subject || item.email || fullName || item.id,
  )
}

function dropdownKey(dynamic: unknown) {
  return typeof dynamic === "string" ? dynamic.split(".")[0] : null
}

function parameterName(operation: string, fieldKey: string) {
  return `${operation}_${fieldKey}`
}

function parseJsonField(key: string, value: unknown) {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    throw new Error(`${key} must be valid JSON.`)
  }
}

function normalizeFieldValue(field: Field, value: unknown) {
  if (Array.isArray(field.children)) {
    const collection = value as Record<string, unknown> | undefined
    return collection?.[field.key as string]
  }

  return value
}

function makeN8nField(field: Field, operation: string, resourceKey: ResourceKey) {
  const key = String(field.key)
  const dynamic = dropdownKey(field.dynamic)
  const children = Array.isArray(field.children)
    ? (field.children as Field[])
    : null
  const isJsonField = (resources[resourceKey].jsonFields ?? []).includes(key)

  const base: INodeProperties = {
    default: "",
    displayName: String(field.label),
    displayOptions: {
      show: {
        operation: [operation],
        resource: [resourceKey],
      },
    },
    name: parameterName(operation, key),
    required: operation === "create" && Boolean(field.required),
    type: "string",
  }

  if (children) {
    return {
      ...base,
      options: [
        {
          displayName: String(field.label),
          name: key,
          values: children.map((child) => ({
            ...makeN8nField(child, operation, resourceKey),
            displayOptions: undefined,
            name: String(child.key),
          })),
        },
      ],
      type: "fixedCollection",
      typeOptions: {
        multipleValues: true,
      },
    } satisfies INodeProperties
  }

  if (dynamic) {
    return {
      ...base,
      default: "",
      type: field.list ? "multiOptions" : "options",
      typeOptions: {
        loadOptionsMethod: dropdownMethodByKey[dynamic],
      },
    } satisfies INodeProperties
  }

  if (field.type === "boolean") {
    return {
      ...base,
      default: false,
      type: "boolean",
    } satisfies INodeProperties
  }

  if (field.type === "number") {
    return {
      ...base,
      default: undefined,
      type: "number",
    } satisfies INodeProperties
  }

  if (field.type === "text" || isJsonField) {
    return {
      ...base,
      type: isJsonField ? "json" : "string",
      typeOptions: {
        alwaysOpenEditWindow: true,
      },
    } satisfies INodeProperties
  }

  if (field.list) {
    return {
      ...base,
      typeOptions: {
        multipleValues: true,
      },
    } satisfies INodeProperties
  }

  return base
}

function recordIdField(
  resourceKey: ResourceKey,
  operation: "get" | "update" | "delete",
) {
  const resource = resources[resourceKey]
  const dynamic = dropdownKey(resource.dropdown)

  return {
    default: "",
    displayName: resource.noun,
    displayOptions: {
      show: {
        operation: [operation],
        resource: [resourceKey],
      },
    },
    name: `${operation}_record_id`,
    required: true,
    type: dynamic ? "options" : "string",
    typeOptions: dynamic
      ? {
          loadOptionsMethod: dropdownMethodByKey[dynamic],
        }
      : undefined,
  } satisfies INodeProperties
}

function operationOptions(resourceKey: ResourceKey) {
  const resource = resources[resourceKey]
  const operations: INodePropertyOptions[] = [
    { name: `List ${resource.noun}s`, value: "list" },
    { name: `Get ${resource.noun}`, value: "get" },
  ]

  if (resource.canCreate !== false) {
    operations.push({ name: `Create ${resource.noun}`, value: "create" })
  }

  if (resource.canUpdate !== false) {
    operations.push({ name: `Update ${resource.noun}`, value: "update" })
  }

  if (deletableResources.has(resourceKey)) {
    operations.push({ name: `Delete ${resource.noun}`, value: "delete" })
  }

  if (resourceKey === "appointments") {
    operations.push(
      { name: "Book Appointment", value: "bookAppointment" },
      { name: "Cancel Appointment", value: "cancelAppointment" },
      { name: "Reschedule Appointment", value: "rescheduleAppointment" },
    )
  }

  if (resourceKey === "documents") {
    operations.push({ name: "Send Document", value: "sendDocument" })
  }

  if (resourceKey === "forms") {
    operations.push({ name: "Submit Form", value: "submitForm" })
  }

  return operations
}

function operationProperty(resourceKey: ResourceKey) {
  return {
    default: "list",
    displayName: "Operation",
    displayOptions: {
      show: {
        resource: [resourceKey],
      },
    },
    name: "operation",
    noDataExpression: true,
    options: operationOptions(resourceKey),
    required: true,
    type: "options",
  } satisfies INodeProperties
}

function specialField(
  name: string,
  label: string,
  resourceKey: ResourceKey,
  operation: string,
  type: INodeProperties["type"] = "string",
  required = false,
  loadOptionsMethod?: string,
) {
  return {
    default: type === "boolean" ? false : "",
    displayName: label,
    displayOptions: {
      show: {
        operation: [operation],
        resource: [resourceKey],
      },
    },
    name,
    required,
    type: loadOptionsMethod ? "options" : type,
    typeOptions: loadOptionsMethod ? { loadOptionsMethod } : undefined,
  } satisfies INodeProperties
}

function buildProperties() {
  const properties: INodeProperties[] = [
    {
      default: "contacts",
      displayName: "Resource",
      name: "resource",
      noDataExpression: true,
      options: (Object.keys(resources) as ResourceKey[]).map((key) => ({
        name: resources[key].noun,
        value: key,
      })),
      required: true,
      type: "options",
    },
    ...(Object.keys(resources) as ResourceKey[]).map(operationProperty),
  ]

  for (const resourceKey of Object.keys(resources) as ResourceKey[]) {
    const resource = resources[resourceKey]

    properties.push(
      {
        default: 50,
        description: "Maximum records to return.",
        displayName: "Limit",
        displayOptions: {
          show: {
            operation: ["list"],
            resource: [resourceKey],
          },
        },
        name: "limit",
        type: "number",
        typeOptions: {
          minValue: 1,
        },
      },
      ...resource.filters.map((field) => makeN8nField(field, "list", resourceKey)),
      recordIdField(resourceKey, "get"),
    )

    if (resource.canCreate !== false) {
      properties.push(
        ...resource.createFields.map((field) =>
          makeN8nField(field, "create", resourceKey),
        ),
      )
    }

    if (resource.canUpdate !== false) {
      properties.push(
        recordIdField(resourceKey, "update"),
        ...resource.createFields.map((field) =>
          makeN8nField(field, "update", resourceKey),
        ),
      )
    }

    if (deletableResources.has(resourceKey)) {
      properties.push(recordIdField(resourceKey, "delete"))
    }
  }

  properties.push(
    specialField(
      "booking_page_slug",
      "Booking Page",
      "appointments",
      "bookAppointment",
      "string",
      true,
      "listBookingPagesBySlug",
    ),
    specialField(
      "event_type_slug",
      "Event Type",
      "appointments",
      "bookAppointment",
      "string",
      true,
      "listEventTypesBySlug",
    ),
    specialField("invitee_name", "Invitee Name", "appointments", "bookAppointment", "string", true),
    specialField("invitee_email", "Invitee Email", "appointments", "bookAppointment", "string", true),
    specialField("invitee_phone", "Invitee Phone", "appointments", "bookAppointment"),
    specialField("start_time", "Start Time", "appointments", "bookAppointment", "string", true),
    specialField("timezone", "Timezone", "appointments", "bookAppointment"),
    specialField("notes", "Notes", "appointments", "bookAppointment", "string"),
    specialField("intake_payload", "Intake Payload JSON", "appointments", "bookAppointment", "json"),
    specialField(
      "appointment_id",
      "Appointment",
      "appointments",
      "cancelAppointment",
      "string",
      true,
      "listAppointments",
    ),
    specialField("cancel_reason", "Reason", "appointments", "cancelAppointment"),
    specialField(
      "reschedule_appointment_id",
      "Appointment",
      "appointments",
      "rescheduleAppointment",
      "string",
      true,
      "listAppointments",
    ),
    specialField("reschedule_start_time", "Start Time", "appointments", "rescheduleAppointment", "string", true),
    specialField("reschedule_end_time", "End Time", "appointments", "rescheduleAppointment", "string", true),
    specialField("reschedule_timezone", "Timezone", "appointments", "rescheduleAppointment"),
    specialField("reschedule_reason", "Reason", "appointments", "rescheduleAppointment"),
    specialField(
      "send_document_id",
      "Document",
      "documents",
      "sendDocument",
      "string",
      true,
      "listDocuments",
    ),
    specialField("send_subject", "Subject", "documents", "sendDocument", "string", true),
    specialField("send_body", "Body", "documents", "sendDocument", "string", true),
    specialField("send_to", "To", "documents", "sendDocument", "string", true),
    specialField("send_cc", "CC", "documents", "sendDocument"),
    specialField("send_bcc", "BCC", "documents", "sendDocument"),
    specialField(
      "submit_form_id",
      "Form",
      "forms",
      "submitForm",
      "string",
      true,
      "listForms",
    ),
    specialField("submission_data", "Submission Data JSON", "forms", "submitForm", "json", true),
  )

  return properties
}

async function listDropdownOptions(
  this: ILoadOptionsFunctions,
  definition: DropdownDefinition,
) {
  const items = unwrapList(await agiledApiRequest.call(this, "GET", definition.path))

  return items.map((item) => {
    const record = item as JsonObject
    const value = definition.valueKey ? record[definition.valueKey] : record.id

    return {
      name: optionLabel(record, definition.labelKey),
      value: value == null ? String(record.id) : String(value),
    }
  })
}

async function listStages(this: ILoadOptionsFunctions) {
  const pipelines = unwrapList(await agiledApiRequest.call(this, "GET", "/pipelines"))

  return pipelines.flatMap((pipeline) => {
    const record = pipeline as JsonObject
    if (!Array.isArray(record.stages)) {
      return []
    }

    return record.stages.map((stage) => {
      const item = stage as JsonObject
      return {
        name: `${record.name || "Pipeline"} - ${item.name || item.id}`,
        value: String(item.id),
      }
    })
  })
}

function listQuery(
  this: IExecuteFunctions,
  itemIndex: number,
  resourceKey: ResourceKey,
) {
  const resource = resources[resourceKey]
  const input: JsonObject = {
    page: 1,
    per_page: this.getNodeParameter("limit", itemIndex, 50),
    sort_by: resource.sort,
    sort_direction: "desc",
  }

  for (const field of resource.filters) {
    input[String(field.key)] = this.getNodeParameter(
      parameterName("list", String(field.key)),
      itemIndex,
      undefined,
    )
  }

  return cleanObject(input)
}

function readInputFields(
  this: IExecuteFunctions,
  itemIndex: number,
  resourceKey: ResourceKey,
  operation: "create" | "update",
) {
  const resource = resources[resourceKey]
  const input: JsonObject = {}

  for (const field of resource.createFields) {
    const key = String(field.key)
    input[key] = normalizeFieldValue(
      field,
      this.getNodeParameter(parameterName(operation, key), itemIndex, undefined),
    ) as JsonObject[string]
  }

  for (const key of resource.jsonFields ?? []) {
    if (key in input) {
      input[key] = parseJsonField(key, input[key]) as JsonObject[string]
    }
  }

  return cleanObject(input)
}

function splitList(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export class Agiled implements INodeType {
  description: INodeTypeDescription = {
    credentials: [
      {
        name: "agiledOAuth2Api",
        required: true,
      },
    ],
    defaults: {
      name: "Agiled",
    },
    description: "Use the Agiled public API",
    displayName: "Agiled",
    group: ["transform"],
    inputs: [NodeConnectionTypes.Main],
    name: "agiled",
    outputs: [NodeConnectionTypes.Main],
    properties: buildProperties(),
    usableAsTool: true,
    version: 1,
  }

  methods = {
    loadOptions: {
      ...Object.fromEntries(
        dropdownDefinitions.map((definition) => [
          dropdownMethodByKey[definition.key],
          function (this: ILoadOptionsFunctions) {
            return listDropdownOptions.call(this, definition)
          },
        ]),
      ),
      listStages,
    },
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData()
    const returnData: INodeExecutionData[] = []

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const resourceKey = this.getNodeParameter("resource", itemIndex) as ResourceKey
      const operation = this.getNodeParameter("operation", itemIndex) as string
      const resource = resources[resourceKey]

      if (operation === "list") {
        const response = await agiledApiRequest.call(
          this,
          "GET",
          resource.path,
          undefined,
          listQuery.call(this, itemIndex, resourceKey),
        )
        for (const record of unwrapList(response)) {
          returnData.push({ json: record as IDataObject })
        }
        continue
      }

      if (operation === "get") {
        const id = this.getNodeParameter("get_record_id", itemIndex) as string
        returnData.push({
          json: unwrapData(
            await agiledApiRequest.call(this, "GET", `${resource.path}/${id}`),
          ) as IDataObject,
        })
        continue
      }

      if (operation === "create") {
        returnData.push({
          json: unwrapData(
            await agiledApiRequest.call(
              this,
              "POST",
              resource.path,
              readInputFields.call(this, itemIndex, resourceKey, "create"),
            ),
          ) as IDataObject,
        })
        continue
      }

      if (operation === "update") {
        const id = this.getNodeParameter("update_record_id", itemIndex) as string
        returnData.push({
          json: unwrapData(
            await agiledApiRequest.call(
              this,
              "PATCH",
              `${resource.path}/${id}`,
              readInputFields.call(this, itemIndex, resourceKey, "update"),
            ),
          ) as IDataObject,
        })
        continue
      }

      if (operation === "delete") {
        const id = this.getNodeParameter("delete_record_id", itemIndex) as string
        const deleted = await agiledApiRequest.call(
          this,
          "DELETE",
          `${resource.path}/${id}`,
        )
        returnData.push({ json: (unwrapData(deleted) || { id }) as IDataObject })
        continue
      }

      if (operation === "bookAppointment") {
        const payload = cleanObject({
          booking_page_slug: this.getNodeParameter("booking_page_slug", itemIndex),
          event_type_slug: this.getNodeParameter("event_type_slug", itemIndex),
          intake_payload: parseJsonField(
            "intake_payload",
            this.getNodeParameter("intake_payload", itemIndex, undefined),
          ),
          invitee_email: this.getNodeParameter("invitee_email", itemIndex),
          invitee_name: this.getNodeParameter("invitee_name", itemIndex),
          invitee_phone: this.getNodeParameter("invitee_phone", itemIndex, undefined),
          notes: this.getNodeParameter("notes", itemIndex, undefined),
          start_time: this.getNodeParameter("start_time", itemIndex),
          timezone: this.getNodeParameter("timezone", itemIndex, undefined),
        })
        returnData.push({
          json: unwrapData(
            await agiledApiRequest.call(this, "POST", "/bookings", payload),
          ) as IDataObject,
        })
        continue
      }

      if (operation === "cancelAppointment") {
        const id = this.getNodeParameter("appointment_id", itemIndex) as string
        returnData.push({
          json: unwrapData(
            await agiledApiRequest.call(
              this,
              "POST",
              `/appointments/${id}/cancel`,
              cleanObject({
                reason: this.getNodeParameter("cancel_reason", itemIndex, undefined),
              }),
            ),
          ) as IDataObject,
        })
        continue
      }

      if (operation === "rescheduleAppointment") {
        const id = this.getNodeParameter(
          "reschedule_appointment_id",
          itemIndex,
        ) as string
        returnData.push({
          json: unwrapData(
            await agiledApiRequest.call(
              this,
              "POST",
              `/appointments/${id}/reschedule`,
              cleanObject({
                end_time: this.getNodeParameter("reschedule_end_time", itemIndex),
                reason: this.getNodeParameter(
                  "reschedule_reason",
                  itemIndex,
                  undefined,
                ),
                start_time: this.getNodeParameter(
                  "reschedule_start_time",
                  itemIndex,
                ),
                timezone: this.getNodeParameter(
                  "reschedule_timezone",
                  itemIndex,
                  undefined,
                ),
              }),
            ),
          ) as IDataObject,
        })
        continue
      }

      if (operation === "sendDocument") {
        const id = this.getNodeParameter("send_document_id", itemIndex) as string
        returnData.push({
          json: unwrapData(
            await agiledApiRequest.call(
              this,
              "POST",
              `/documents/${id}/send`,
              cleanObject({
                bcc: splitList(this.getNodeParameter("send_bcc", itemIndex, undefined)),
                body: this.getNodeParameter("send_body", itemIndex),
                cc: splitList(this.getNodeParameter("send_cc", itemIndex, undefined)),
                subject: this.getNodeParameter("send_subject", itemIndex),
                to: splitList(this.getNodeParameter("send_to", itemIndex)),
              }),
            ),
          ) as IDataObject,
        })
        continue
      }

      if (operation === "submitForm") {
        const id = this.getNodeParameter("submit_form_id", itemIndex) as string
        returnData.push({
          json: unwrapData(
            await agiledApiRequest.call(this, "POST", `/forms/${id}/submissions`, {
              data: parseJsonField(
                "submission_data",
                this.getNodeParameter("submission_data", itemIndex),
              ),
            }),
          ) as IDataObject,
        })
        continue
      }

      throw new Error(`Unsupported ${resources[resourceKey].noun} operation.`)
    }

    return [returnData]
  }
}
