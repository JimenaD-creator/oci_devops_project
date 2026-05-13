workspace "Project Manager" "Sprint work, KPIs, AI sprint insights, manager Q&A, and Telegram task bot." {

    model {
        developer = person "Developer" "Updates own tasks via Telegram; checks personal KPIs and AI views on the web when needed." "Person"
        manager = person "Manager" "Plans team tasks and sprints, monitors KPIs and AI sprint insights, uses manager chat." "Person"
        administrator = person "Administrator" "Creates projects and teams, assigns members, maintains catalog data." "Person"

        telegram = softwareSystem "Telegram" "Messaging app for task-bot commands and replies." "External System"
        gemini = softwareSystem "Google Gemini API" "Embeddings and generated text for insights and manager chat." "External System"

        taskManager = softwareSystem "Task Manager" "Plans and tracks work, KPIs, AI sprint narratives, manager chat over task data, and Telegram bot flows." {
            reactApp = container "React Frontend" "Web UI for tasks, KPIs, AI insights, manager chat, radar, and admin." "React 18" "Web Browser, Container, Single-page application"
            apiApp = container "Spring Boot Backend" "Business logic, HTTP APIs, jobs, Telegram bot, and AI orchestration." "Java 17, Spring Boot" "Container, Server-side application" {
                kpiApi = component "KPI API" "Exposes productivity and delivery metrics; can refresh KPI aggregates." "Spring REST"
                managerChatApi = component "Manager chat API" "Entry point for contextual manager chat." "Spring REST"
                insightsApi = component "Sprint insights API" "Starts and reads asynchronous sprint insight generation." "Spring REST"
                embeddingsApi = component "Embeddings API" "Indexes sprint work for semantic search." "Spring REST"
                domainApi = component "Domain API" "Tasks, projects, sprints, teams, users, assignments, admin, radar, legacy task list." "Spring REST"

                telegramBot = component "Telegram bot" "Receives messages and runs bot command flows." "TelegramBots SDK"
                taskOps = component "Task operations" "Creates and updates tasks from the bot." "Spring Service"
                sprintContext = component "Sprint context" "Handles sprint selection in bot flows." "Spring Service"
                assignments = component "Assignments" "Reads and updates user–task and sprint-task data for the bot." "Spring Service"
                userDirectory = component "User directory" "Resolves users for bot menus." "Spring Service"
                telegramIdentity = component "Telegram identity bridge" "Links Telegram chats to application users." "Spring Service"

                kpiEngine = component "KPI engine" "Computes and stores sprint KPI fields from aggregates." "Spring Service"
                sprintAi = component "Sprint AI orchestration" "Builds insight prompts, calls the LLM, stores sprint narratives." "Spring Service"
                semanticRetrieval = component "Semantic retrieval" "Embeds text and finds similar stored tasks." "Spring Service"
                chatOrchestration = component "Chat orchestration" "Builds retrieval context and calls the LLM for manager chat." "Spring Service"

                dataRepo = component "Data Repository" "Persists domain data, such as projects, tasks, and sprint KPI snapshots." "Spring Data JPA / JDBC"
            }

            database = container "Oracle Autonomous DB" "Stores application data, KPIs, AI insights, and task search vectors." "Oracle ADB" "Database"
        }

        developer -> reactApp "Views sprint tasks, personal KPIs, and sprint insight pages using the product interface"
        developer -> telegram "Lists and completes tasks, sends bot commands, and reads bot prompts in chat"
        manager -> reactApp "Manages backlog and sprints, reviews KPIs and sprint narratives, and uses manager chat using the product interface"
        manager -> telegram "Sends operator commands and reads team bot notifications in chat"
        administrator -> reactApp "Creates projects and teams, assigns members, and edits catalog master data using the product interface"

        reactApp -> kpiApi "Fetches KPI snapshots and requests KPI recomputation jobs using" "JSON / HTTPS"
        reactApp -> managerChatApi "Sends chat turns with project and optional sprint scope; receives assistant replies using" "JSON / HTTPS"
        reactApp -> insightsApi "Starts asynchronous insight jobs and retrieves stored sprint narratives using" "JSON / HTTPS"
        reactApp -> embeddingsApi "Requests sprint-wide embedding rebuilds for semantic search using" "JSON / HTTPS"
        reactApp -> domainApi "Creates, reads, updates, and deletes tasks, projects, sprints, teams, users, assignments, radar, and admin data using" "JSON / HTTPS"

        telegram -> telegramBot "Delivers inbound messages, edits, and callback queries to the task bot"
        telegramBot -> taskOps "Runs the parsed task command through the task operations service using"
        telegramBot -> sprintContext "Reads and stores which sprint this Telegram conversation is working in using"
        telegramBot -> assignments "Loads and updates assigned sprint work for the signed-in bot user using"
        telegramBot -> userDirectory "Loads directory information to render bot menus and roster pickers using"
        telegramBot -> telegramIdentity "Resolves which application account is linked to this Telegram chat using"

        taskOps -> dataRepo "Reads and writes task records affected by the bot command using" "JPA / JDBC"
        sprintContext -> dataRepo "Reads and updates the bot’s sprint selection state for the chat using" "JPA / JDBC"
        assignments -> dataRepo "Reads and updates assignment and sprint-task data for the acting user using" "JPA / JDBC"
        userDirectory -> dataRepo "Reads user directory data for bot menus using" "JPA / JDBC"
        telegramIdentity -> dataRepo "Reads and writes links between Telegram accounts and application users using" "JPA / JDBC"

        managerChatApi -> chatOrchestration "Routes authenticated browser chat traffic into orchestration using" "Spring"
        insightsApi -> sprintAi "Starts asynchronous sprint insight work on the insight pipeline using" "Spring"

        embeddingsApi -> semanticRetrieval "Requests sprint-wide embedding build or refresh work using" "Spring"

        kpiApi -> kpiEngine "Invokes KPI recomputation and aggregate reads using" "Spring"
        kpiApi -> dataRepo "Runs KPI aggregates and reads stored KPI fields for API responses using" "JPA / JDBC"

        chatOrchestration -> semanticRetrieval "Turns the manager question into embeddings and retrieves similar tasks using" "Spring"
        semanticRetrieval -> gemini "Sends text to obtain embeddings and receives embedding vectors" "HTTPS"
        chatOrchestration -> dataRepo "Loads project, sprint, and ranked task excerpts for the composed prompt using" "JPA / JDBC"
        chatOrchestration -> gemini "Sends the composed prompt and receives the natural-language answer" "HTTPS"

        sprintAi -> gemini "Sends sprint insight prompts and receives generated narrative text" "HTTPS"
        sprintAi -> kpiEngine "Refreshes KPI aggregates for the sprint before assembling the prompt using" "Spring"
        sprintAi -> dataRepo "Loads sprint roster and context, then stores generated insight text using" "JPA / JDBC"

        kpiEngine -> dataRepo "Updates KPI fields and runs aggregate queries for KPI calculations using" "JPA / JDBC"

        semanticRetrieval -> dataRepo "Reads task content and stores embedding vectors for similarity search using" "JPA / JDBC"

        domainApi -> dataRepo "Reads from and writes to stored domain data through the data repository using" "JPA / JDBC"

        dataRepo -> database "Uses database connections to run queries and map results using" "Oracle / JDBC"

        deploymentEnvironment "Production" {
            deploymentNode "Oracle Cloud Infrastructure" {
                containerInstance database

                deploymentNode "Oracle Kubernetes Engine (OKE)" {
                    deploymentNode "Namespace mtdrworkshop" "Logical boundary in the cluster for the product’s workloads." "Kubernetes" {
                        productionLb = infrastructureNode "OCI load balancer" "Public entry point: OCI network load balancer forwards port 80 to the backend service port." "Kubernetes / OCI"

                        deploymentNode "Frontend Pod" {
                            productionWeb = containerInstance reactApp
                        }

                        deploymentNode "Backend Pod" "Spring Boot API workload running as two pod replicas." "Kubernetes" {
                            instances "2"
                            productionApi = containerInstance apiApp
                        }

                        productionLb -> productionApi "Routes inbound HTTP traffic to the API pods"
                    }
                }
            }
        }
    }

    views {
        systemContext taskManager "SystemContext" {
            include *
        }

        container taskManager "Containers" {
            include *
        }

        component apiApp "Components" {
            include *
        }

        deployment taskManager "Production" "Deployment" {
            include *
        }

        dynamic apiApp "RAG_Manager_Chat" "Manager chat with retrieval then LLM answer." {
            managerChatApi -> chatOrchestration "Authenticates the caller and forwards the chat message with project and optional sprint scope"
            chatOrchestration -> semanticRetrieval "Sends the latest manager question to the embedding and retrieval step"
            semanticRetrieval -> gemini "Obtains embedding vectors for question and task text from the cloud model" "HTTPS"
            chatOrchestration -> dataRepo "Loads the most similar tasks plus project and sprint context for the answer" "JPA / JDBC"
            chatOrchestration -> gemini "Sends the composed prompt and receives the assistant’s natural-language reply" "HTTPS"
            autoLayout lr
        }

        dynamic apiApp "Sprint_Insights_Generation" "Background job: KPIs, context, LLM, save insight." {
            insightsApi -> sprintAi "Accepts a browser request to generate a narrative for a chosen sprint"
            sprintAi -> kpiEngine "Recomputes or reads frozen KPI aggregates for that sprint"
            sprintAi -> dataRepo "Loads sprint roster, tasks, and recent summaries to build the insight context" "JPA / JDBC"
            sprintAi -> gemini "Sends the insight prompt and receives generated narrative text" "HTTPS"
            sprintAi -> dataRepo "Persists the new sprint insight text and audit metadata" "JPA / JDBC"
            autoLayout lr
        }

        dynamic apiApp "Embedding_Sprint_Index" "Embed all tasks in one sprint." {
            embeddingsApi -> semanticRetrieval "Accepts a request to embed or re-embed all tasks in a sprint"
            semanticRetrieval -> dataRepo "Loads each task’s title and description for that sprint" "JPA / JDBC"
            semanticRetrieval -> gemini "Sends text batches to the model and receives embedding vectors" "HTTPS"
            semanticRetrieval -> dataRepo "Stores or replaces stored vectors for search alongside model metadata" "JPA / JDBC"
            autoLayout lr
        }

        dynamic apiApp "Telegram_Task_Command" "Resolve user then update tasks." {
            telegram -> telegramBot "Delivers inbound chat text and interaction metadata to the bot listener"
            telegramBot -> telegramIdentity "Asks the identity bridge which application user owns this Telegram chat"
            telegramIdentity -> dataRepo "Reads or updates the stored link between Telegram and application accounts" "JPA / JDBC"
            telegramBot -> taskOps "Interprets the command and runs the matching task workflow"
            taskOps -> dataRepo "Reads and writes task records for that user in a single transactional step" "JPA / JDBC"
            autoLayout lr
        }

        styles {
            relationship "Relationship" {
                width 520
            }

            element "External System" {
                shape RoundedBox
                background #999999
                color #ffffff
                height 220
            }

            element "Software System" {
                shape RoundedBox
                height 320
            }

            element "Container" {
                shape RoundedBox
            }

            element "Component" {
                shape Component
            }

            element "Database" {
                shape Cylinder
            }

            element "Web Browser" {
                shape WebBrowser
            }

            element "Person" {
                shape Person
                background #08427b
                color #ffffff
                height 260
            }
        }
    }
}
